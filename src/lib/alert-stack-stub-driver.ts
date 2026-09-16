import { useRealtimeStore } from '@/store/realtime'
import type { AlertInstanceState, AlertPhase } from '@/machines/alert-lifecycle'

// STUB — still, for entering/revealing/exiting: stands in for the entrance
// and reveal animations finishing, and the exit animation finishing, until
// a visual presentation layer exists. Every duration below is a
// placeholder guess, not tuned to anything.
//
// holding is deliberately absent — real audio drives that transition now
// (components/shared/alert-audio-driver.tsx, dispatching audio:ended),
// since that part never needed a stub in the first place. Neither
// machines/alert-lifecycle.ts nor machines/alert-stack.ts change either
// way, since neither one knows this file — or the audio driver — exists.
const STUB_PHASE_DURATIONS: Partial<Record<AlertPhase, number>> = {
  entering: 600,
  revealing: 400,
  exiting: 500,
}

const STUB_PHASE_EVENTS = {
  entering: 'enter:complete',
  revealing: 'reveal:complete',
} as const

const MAX_CONCURRENT_ALERTS = Number(import.meta.env.VITE_ALERT_STACK_MAX) || 1

const timers = new Map<string, { timer: ReturnType<typeof setTimeout>; lifecycle: AlertInstanceState }>()

function scheduleNext(id: string, lifecycle: AlertInstanceState): void {
  const existing = timers.get(id)
  // Same phase means this instance hasn't moved since we last looked — a
  // timer is already in flight for it, leave it alone. Compared on phase
  // alone, not the whole lifecycle object: audio:ended arriving early
  // (during entering/revealing) changes audioEndedEarly without changing
  // phase, and that must NOT restart this stub's entering/revealing timer
  // from zero — that's real audio's business, not this one's.
  if (existing && existing.lifecycle.phase === lifecycle.phase) return

  if (existing) clearTimeout(existing.timer)
  timers.delete(id)

  // holding has no stub timer — real audio (alert-audio-driver.tsx) owns
  // getting out of it.
  if (lifecycle.phase === 'holding') return

  const duration = STUB_PHASE_DURATIONS[lifecycle.phase]
  if (duration === undefined) return

  const timer = setTimeout(() => {
    timers.delete(id)

    if (lifecycle.phase === 'exiting') {
      useRealtimeStore.getState().dispatchAlertStack({ type: 'stack:reap', id })
      return
    }

    useRealtimeStore.getState().dispatchAlertStack({
      type: 'stack:lifecycle',
      id,
      event: STUB_PHASE_EVENTS[lifecycle.phase as 'entering' | 'revealing'],
    })
  }, duration)

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
