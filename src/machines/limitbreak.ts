import { transition, type Transitions } from './transition'

// The real cycle that used to hide behind use-limitbreak.ts's
// hasJustMaxed/hasJustExecuted booleans (retired): charging -> maxed ->
// executing -> charging. Confirmed with synthfunc (2026-09-15) before
// building this:
//
// - Connected-client ordering is airtight — executed and the isMaxed:true
//   update it depends on come from the same count in the same server
//   function call, over one ordered transport. They can be DAYS apart,
//   though, never assume adjacency.
// - The connect window is a real race: the Redis listener starts before
//   the initial sync (a live Helix call) resolves, so a client
//   reconnecting mid-execution can see 'executed' before a stale sync
//   that contradicts it. Hence: executed is accepted from ANY state, not
//   just 'maxed'.
// - isMaxed is level-triggered (true on every update while the queue
//   sits at/above threshold), not edge-triggered — the wiring layer must
//   derive the charging->maxed edge itself, the same way
//   mic-status-adapter.ts derives mute:muted/unmuted from a raw payload.
// - The post-execution reset only actually reached clients as of
//   synthfunc 265efee (2026-09-13) — inferring behavior from watching an
//   older build would have been watching the bug.
export type LimitBreakPhase = 'charging' | 'maxed' | 'executing'
export type LimitBreakEvent = 'bars:maxed' | 'limitbreak:executed' | 'audio:ended'

export const LIMITBREAK_TRANSITIONS: Transitions<LimitBreakPhase> = {
  // executed accepted here too — the connect-window race means a client
  // can see it before ever observing a maxed update.
  charging: { 'bars:maxed': 'maxed', 'limitbreak:executed': 'executing' },
  maxed: { 'limitbreak:executed': 'executing' },
  // No entry for limitbreak:executed here — a double-fire while already
  // executing is ignored by default, same as any unhandled event. Only
  // the real execution audio ending moves this forward. No entry for
  // bars:maxed either — a new redemption re-crossing the threshold must
  // not preempt the current pulse; see maxedDuringExecuting below for
  // where that signal actually goes instead of being lost.
  executing: { 'audio:ended': 'charging' },
}

export interface LimitBreakState {
  phase: LimitBreakPhase
  // A new redemption can re-cross the threshold while the previous
  // execution's audio is still playing — the transition table above
  // correctly drops bars:maxed while executing, but that edge must be
  // remembered, not discarded: replaying it once audio:ended returns us
  // to charging. Deliberately NOT implemented by re-reading raw wire
  // data (state.limitbreak.isMaxed) at that moment instead — the actual
  // reset update and the local audio-completion timer aren't
  // synchronized, so a stale isMaxed:true (the reset hasn't arrived yet)
  // is indistinguishable from a genuine re-max if you go back to the
  // data rather than remembering the specific edge that was observed.
  // Same shape as alert-lifecycle.ts's audioEndedEarly.
  maxedDuringExecuting: boolean
}

export function newLimitBreakState(): LimitBreakState {
  return { phase: 'charging', maxedDuringExecuting: false }
}

export function limitBreakReducer(state: LimitBreakState, event: LimitBreakEvent): LimitBreakState {
  if (event === 'bars:maxed' && state.phase === 'executing') {
    return { ...state, maxedDuringExecuting: true }
  }

  const phase = transition(LIMITBREAK_TRANSITIONS, state.phase, event)

  // Reveal the re-max the instant we're back in charging, rather than
  // exposing 'charging' at all when it's already stale.
  if (phase === 'charging' && state.maxedDuringExecuting) {
    return { phase: 'maxed', maxedDuringExecuting: false }
  }

  return { phase, maxedDuringExecuting: phase === 'maxed' ? false : state.maxedDuringExecuting }
}
