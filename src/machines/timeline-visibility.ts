import { transition, type Transitions } from './transition'

// Timeline's own widget-level show/hide — "Machine B" from when the
// timeline was first split into three separate concerns (the other two:
// admission, machines/timeline-admission.ts, and per-item "already
// introduced" bookkeeping, which stays presentation-layer in the
// component). Driven by chat/redemption activity (lastPushTime) and an
// idle timeout; the timeout itself — how long to wait before auto-hiding —
// stays in components/shared/timeline/index.tsx, same split every other
// machine here keeps between phase-naming and timing/pacing.
export type TimelineVisibilityPhase = 'hidden' | 'visible'
export type TimelineVisibilityEvent = 'timeline:pushed' | 'timeline:idle'

export const TIMELINE_VISIBILITY_TRANSITIONS: Transitions<TimelineVisibilityPhase> = {
  hidden: { 'timeline:pushed': 'visible' },
  // No entry for 'timeline:pushed' here — staying visible on a further
  // push is already the correct no-op default. The component still resets
  // its own hide timer on every push regardless of whether this phase
  // itself changes.
  visible: { 'timeline:idle': 'hidden' },
}

export function timelineVisibilityReducer(
  phase: TimelineVisibilityPhase,
  event: TimelineVisibilityEvent,
): TimelineVisibilityPhase {
  return transition(TIMELINE_VISIBILITY_TRANSITIONS, phase, event)
}
