import { useRealtimeStore } from '@/store/realtime'

// The synthmult wire envelope's payload shape — see machines/mic-status.ts
// for the connection/mute state machine this feeds.
export interface SynthmixMicStatus {
  channel: number
  muted: boolean
  timestamp: string
}

export function useMicStatus() {
  const { connection, mute } = useRealtimeStore((s) => s.synthmix)

  return {
    // Raw machine states — use these when "unknown" needs to render
    // differently from "confirmed unmuted".
    connection,
    mute,
    // Convenience booleans. isMuted collapses `unknown` into false, same as
    // `unmuted` — a consumer that only reads isMuted can't tell "definitely
    // not muted" from "no idea yet".
    isConnected: connection === 'connected',
    isMuted: mute === 'muted',
  }
}
