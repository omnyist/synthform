import { useRealtimeStore } from '@/store/realtime'
import type { AlertInstanceState, AlertPhase } from '@/machines/alert-lifecycle'

// STUB. Stands in for real animation/audio callbacks (the entrance
// animation finishing, the reveal flourish finishing, the alert's own
// sound ending) until the presentation layer exists — every duration
// below is a placeholder guess, not tuned to anything. Delete this file
// once real callbacks (onAnimationComplete, an <audio> element's onEnded)
// replace it; machines/alert-lifecycle.ts and machines/alert-stack.ts
// don't change either way, since neither one knows this file exists.
const STUB_PHASE_DURATIONS: Record<AlertPhase, number> = {
  entering: 600,
  revealing: 400,
  holding: 4000,
  exiting: 500,
}

const STUB_PHASE_EVENTS = {
  entering: 'enter:complete',
  revealing: 'reveal:complete',
  holding: 'audio:ended',
} as const

const MAX_CONCURRENT_ALERTS = Number(import.meta.env.VITE_ALERT_STACK_MAX) || 1

const timers = new Map<string, { timer: ReturnType<typeof setTimeout>; lifecycle: AlertInstanceState }>()

function scheduleNext(id: string, lifecycle: AlertInstanceState): void {
  const existing = timers.get(id)
  // Same lifecycle object reference means this instance hasn't moved since
  // we last looked — a timer is already in flight for it, leave it alone.
  if (existing && existing.lifecycle === lifecycle) return

  if (existing) clearTimeout(existing.timer)

  const timer = setTimeout(() => {
    timers.delete(id)

    if (lifecycle.phase === 'exiting') {
      useRealtimeStore.getState().dispatchAlertStack({ type: 'stack:reap', id })
      return
    }

    useRealtimeStore.getState().dispatchAlertStack({
      type: 'stack:lifecycle',
      id,
      event: STUB_PHASE_EVENTS[lifecycle.phase],
    })
  }, STUB_PHASE_DURATIONS[lifecycle.phase])

  timers.set(id, { timer, lifecycle })
}

export function startAlertStackStubDriver(): void {
  useRealtimeStore.getState().setAlertStackCapacity(MAX_CONCURRENT_ALERTS)

  useRealtimeStore.subscribe(
    (state) => state.alertStack.active,
    (active) => {
      const liveIds = new Set(active.map((instance) => instance.id))

      for (const [id, entry] of timers) {
        if (!liveIds.has(id)) {
          clearTimeout(entry.timer)
          timers.delete(id)
        }
      }

      active.forEach((instance) => scheduleNext(instance.id, instance.lifecycle))
    },
    { fireImmediately: true },
  )
}
