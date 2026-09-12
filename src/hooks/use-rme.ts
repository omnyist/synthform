import { useRealtimeStore } from '@/store/realtime'

export interface RMEMicStatus {
  channel: number
  muted: boolean
  timestamp: string
}

export function useMicStatus() {
  const mic = useRealtimeStore((s) => s.rme)
  const isConnected = useRealtimeStore((s) => s.isConnected)

  return {
    channel: mic?.channel ?? 0,
    isMuted: mic?.muted ?? false,
    isConnected,
    timestamp: mic?.timestamp,
  }
}
