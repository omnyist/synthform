import { transition, type Transitions } from './transition'

// One alert card's own life, independent of how many others exist or how
// they're arranged. Reconstructed from Notifier/Item.js in synthavln
// (2019) — that sequence worked, but lived entirely inside an async
// useEffect with no named states, so it couldn't be rebuilt on purpose,
// only stumbled into again. This version makes the same shape explicit.
export type AlertPhase = 'entering' | 'revealing' | 'holding' | 'exiting'
export type AlertLifecycleEvent = 'enter:complete' | 'reveal:complete' | 'audio:ended'

export const ALERT_LIFECYCLE_TRANSITIONS: Transitions<AlertPhase> = {
  entering: { 'enter:complete': 'revealing' },
  revealing: { 'reveal:complete': 'holding' },
  holding: { 'audio:ended': 'exiting' },
  exiting: {},
}

export interface AlertInstanceState {
  phase: AlertPhase
  // A short sting can finish playing before the entrance/reveal animation
  // does — audio:ended arriving early is remembered here rather than
  // dropped, since it's a one-shot browser callback and losing it would
  // strand the card in 'holding' forever. Applied the instant
  // reveal:complete lands, guaranteeing revealing always finishes before
  // a card can exit.
  audioEndedEarly: boolean
}

// A card is born already entering — there is no 'idle' phase here. "No
// card" is the absence of an instance, tracked by whatever owns a
// collection of these (see alert-stack.ts), not a state an instance holds.
export function newAlertInstance(): AlertInstanceState {
  return { phase: 'entering', audioEndedEarly: false }
}

export function alertLifecycleReducer(
  state: AlertInstanceState,
  event: AlertLifecycleEvent,
): AlertInstanceState {
  if (event === 'audio:ended' && state.phase !== 'holding') {
    return { ...state, audioEndedEarly: true }
  }

  const phase = transition(ALERT_LIFECYCLE_TRANSITIONS, state.phase, event)

  // Reveal just finished and audio already ended early — skip exposing
  // 'holding' at all, since it's already over.
  if (phase === 'holding' && state.audioEndedEarly) {
    return { phase: 'exiting', audioEndedEarly: false }
  }

  return { phase, audioEndedEarly: phase === 'exiting' ? false : state.audioEndedEarly }
}
