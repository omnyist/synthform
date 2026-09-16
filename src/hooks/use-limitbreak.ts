import { useRealtimeStore } from '@/store/realtime'
import type { LimitBreakData } from '@/types/server'

export type { LimitBreakData }

// Sound and animation triggers read `phase` directly (see
// machines/limitbreak.ts and use-limitbreak-audio.ts) instead of the old
// hasJustMaxed/hasJustExecuted booleans, which were edge-triggered off
// raw data comparisons rather than a real machine.
export function useLimitbreak() {
  const data = useRealtimeStore((s) => s.limitbreak)
  const phase = useRealtimeStore((s) => s.limitBreakPhase)
  const isConnected = useRealtimeStore((s) => s.isConnected)

  const filledBars = {
    bar1: (data?.bar1 || 0) >= 1,
    bar2: (data?.bar2 || 0) >= 1,
    bar3: (data?.bar3 || 0) >= 1,
  }

  return {
    data,
    count: data?.count || 0,
    phase,
    filledBars,
    isConnected,
  }
}
