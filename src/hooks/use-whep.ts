import { useEffect, useRef, useState } from 'react'

/**
 * Plays a WebRTC stream published through a WHEP endpoint (the telestrator's
 * live feed of OBS program out — see docs/telestrator-v1.5.md).
 *
 * WHEP is one HTTP exchange: POST an SDP offer, get an SDP answer, then the
 * media flows over the peer connection. The server hands back a resource URL
 * in `Location`; a DELETE on it is the polite hangup. No library needed.
 *
 * `url` null = don't connect. Reconnects with backoff (1 s → 15 s) when the
 * feed isn't there yet or drops, so the page can be open before the feed is.
 */

export type WhepState = 'idle' | 'connecting' | 'live' | 'error'

const BACKOFF_MIN = 1_000
const BACKOFF_MAX = 15_000

export function useWhep(url: string | null) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [state, setState] = useState<WhepState>('idle')
  const [error, setError] = useState<string | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const resourceRef = useRef<string | null>(null)
  const retryRef = useRef<number | null>(null)
  const backoffRef = useRef(BACKOFF_MIN)

  useEffect(() => {
    if (!url) {
      setState('idle')
      return
    }
    let disposed = false

    const teardown = () => {
      if (retryRef.current !== null) {
        clearTimeout(retryRef.current)
        retryRef.current = null
      }
      pcRef.current?.close()
      pcRef.current = null
      if (resourceRef.current) {
        fetch(resourceRef.current, { method: 'DELETE' }).catch(() => {})
        resourceRef.current = null
      }
    }

    const scheduleRetry = (reason: string) => {
      if (disposed) return
      setState('error')
      setError(reason)
      setStream(null)
      pcRef.current?.close()
      pcRef.current = null
      resourceRef.current = null
      retryRef.current = window.setTimeout(connect, backoffRef.current)
      backoffRef.current = Math.min(backoffRef.current * 2, BACKOFF_MAX)
    }

    async function connect() {
      if (disposed) return
      setState('connecting')
      setError(null)
      const pc = new RTCPeerConnection()
      pcRef.current = pc
      pc.addTransceiver('video', { direction: 'recvonly' })
      pc.ontrack = (ev) => {
        if (disposed) return
        setStream(ev.streams[0] ?? new MediaStream([ev.track]))
        setState('live')
        backoffRef.current = BACKOFF_MIN
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          scheduleRetry(`peer ${pc.connectionState}`)
        }
      }
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        const res = await fetch(url as string, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: offer.sdp,
        })
        if (!res.ok) throw new Error(`WHEP ${res.status}`)
        const location = res.headers.get('Location')
        if (location) resourceRef.current = new URL(location, url as string).toString()
        const answer = await res.text()
        if (disposed) return
        await pc.setRemoteDescription({ type: 'answer', sdp: answer })
      } catch (err) {
        scheduleRetry(err instanceof Error ? err.message : String(err))
      }
    }

    void connect()
    return () => {
      disposed = true
      teardown()
      setStream(null)
      setState('idle')
    }
  }, [url])

  return { stream, state, error }
}
