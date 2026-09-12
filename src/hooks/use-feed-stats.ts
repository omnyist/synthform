import { useEffect, useRef, useState, type RefObject } from 'react'

import {
  STAMP_BAR_HEIGHT,
  STAMP_BAR_WIDTH,
  STAMP_REFERENCE_HEIGHT,
  STAMP_REFERENCE_WIDTH,
  decodeStamp,
  normalizeSenderClock,
  stampLag,
} from '@/lib/frame-stamp'

/**
 * Once a second while the feed is live: the receive-side numbers from
 * `getStats()` and the latency to source read from the timecode burned into
 * the picture. Mirrors Scribble's `FeedSample` + `FrameStampReader` so both
 * clients show the same figures the same way.
 *
 * Clock offset between Demi and this browser comes from the last RTCP sender
 * report: `remote-outbound-rtp.remoteTimestamp` is the sender's clock when it
 * was sent, that report's own `timestamp` is our clock when it arrived, less
 * half the round trip for the flight. `inbound-rtp.estimatedPlayoutTimestamp`
 * is deliberately not used: libwebrtc never fills it against MediaMTX (pion
 * does not answer RTCP XR), in Chrome as on the iPad.
 */
export interface FeedStats {
  /** `udp` or `tcp` for the nominated candidate pair; browsers may pick TCP. */
  transport: string | null
  rttMs: number | null
  /** Latency to source from the timecode, smoothed. Null until a stamp reads. */
  lagMs: number | null
  /** Jitter-buffer delay over the last interval. */
  bufferMs: number | null
  framesReceived: number
  framesDecoded: number
  framesDropped: number
  packetsLost: number
  freezeCount: number
  /** Receiver − sender clock, ms; null means the lag assumes 0 offset. */
  offsetMs: number | null
  stampMisreads: number
  /** The decoded frame size, so an unexpected scale is visible. */
  frame: string | null
}

const EMPTY: FeedStats = {
  transport: null,
  rttMs: null,
  lagMs: null,
  bufferMs: null,
  framesReceived: 0,
  framesDecoded: 0,
  framesDropped: 0,
  packetsLost: 0,
  freezeCount: 0,
  offsetMs: null,
  stampMisreads: 0,
  frame: null,
}

const INTERVAL_MS = 1_000
const SMOOTHING = 0.3

export function useFeedStats(
  peer: RTCPeerConnection | null,
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): FeedStats {
  const [stats, setStats] = useState<FeedStats>(EMPTY)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastRef = useRef<{ delay: number; emitted: number } | null>(null)
  const lagRef = useRef<number | null>(null)
  const misreadsRef = useRef(0)

  useEffect(() => {
    const video = videoRef.current
    if (!peer || !video || !enabled) {
      setStats(EMPTY)
      lastRef.current = null
      lagRef.current = null
      misreadsRef.current = 0
      return
    }

    const canvas = (canvasRef.current ??= document.createElement('canvas'))
    canvas.width = STAMP_BAR_WIDTH
    canvas.height = STAMP_BAR_HEIGHT
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    let cancelled = false

    const tick = async () => {
      const report = await peer.getStats().catch(() => null)
      if (cancelled || !report) return

      let transport: string | null = null
      let rttMs: number | null = null
      let localCandidateId: string | null = null
      // Assigned inside the forEach closure; a holder keeps TypeScript's
      // narrowing honest afterwards.
      const found: { inbound?: Record<string, number> } = {}
      let srRemote: number | null = null
      let srReceived: number | null = null
      const protocols = new Map<string, string>()

      report.forEach((stat: RTCStats & Record<string, unknown>) => {
        switch (stat.type) {
          case 'inbound-rtp':
            if (stat.kind === 'video') found.inbound = stat as unknown as Record<string, number>
            break
          case 'candidate-pair':
            if (stat.nominated === true && stat.state === 'succeeded') {
              rttMs = typeof stat.currentRoundTripTime === 'number' ? stat.currentRoundTripTime * 1000 : null
              localCandidateId = typeof stat.localCandidateId === 'string' ? stat.localCandidateId : null
            }
            break
          case 'remote-outbound-rtp':
            if (stat.kind === 'video' && typeof stat.remoteTimestamp === 'number') {
              srRemote = stat.remoteTimestamp
              srReceived = stat.timestamp
            }
            break
          case 'local-candidate':
            if (typeof stat.protocol === 'string') protocols.set(stat.id, stat.protocol)
            break
        }
      })
      if (localCandidateId) transport = protocols.get(localCandidateId) ?? null

      const offsetMs =
        srRemote !== null && srReceived !== null
          ? srReceived - normalizeSenderClock(srRemote) - (rttMs ?? 0) / 2
          : null

      // Jitter buffer over the interval: delta of cumulative delay over delta
      // of frames emitted, seconds to ms.
      let bufferMs: number | null = null
      const inbound = found.inbound
      const delay = inbound?.jitterBufferDelay ?? 0
      const emitted = inbound?.jitterBufferEmittedCount ?? 0
      if (lastRef.current && emitted > lastRef.current.emitted) {
        bufferMs = ((delay - lastRef.current.delay) / (emitted - lastRef.current.emitted)) * 1000
      }
      lastRef.current = { delay, emitted }

      // The stamp: draw only the bar region of the current frame, at the
      // 1080p layout's own scale, then read squares from it.
      let frame: string | null = null
      if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
        frame = `${video.videoWidth}x${video.videoHeight}`
        const sx = video.videoWidth / STAMP_REFERENCE_WIDTH
        const sy = video.videoHeight / STAMP_REFERENCE_HEIGHT
        ctx.drawImage(
          video,
          0, 0, STAMP_BAR_WIDTH * sx, STAMP_BAR_HEIGHT * sy,
          0, 0, STAMP_BAR_WIDTH, STAMP_BAR_HEIGHT,
        )
        const pixels = ctx.getImageData(0, 0, STAMP_BAR_WIDTH, STAMP_BAR_HEIGHT).data
        const luma = (x: number, y: number) => {
          const i = (y * STAMP_BAR_WIDTH + x) * 4
          return ((pixels[i] ?? 0) + (pixels[i + 1] ?? 0) + (pixels[i + 2] ?? 0)) / 3
        }
        const stamp = decodeStamp(STAMP_REFERENCE_WIDTH, STAMP_REFERENCE_HEIGHT, luma)
        const now = Date.now()
        const lag = stamp === null ? null : stampLag(now, stamp, offsetMs ?? 0)
        if (lag === null) {
          if (stamp !== null) misreadsRef.current += 1
        } else {
          lagRef.current = lagRef.current === null ? lag : lagRef.current + SMOOTHING * (lag - lagRef.current)
        }
      }

      if (cancelled) return
      setStats({
        transport,
        rttMs,
        lagMs: lagRef.current,
        bufferMs,
        framesReceived: inbound?.framesReceived ?? 0,
        framesDecoded: inbound?.framesDecoded ?? 0,
        framesDropped: inbound?.framesDropped ?? 0,
        packetsLost: inbound?.packetsLost ?? 0,
        freezeCount: inbound?.freezeCount ?? 0,
        offsetMs,
        stampMisreads: misreadsRef.current,
        frame,
      })
    }

    void tick()
    const timer = window.setInterval(() => void tick(), INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [peer, videoRef, enabled])

  return stats
}
