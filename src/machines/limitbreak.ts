import { transition, type Transitions } from './transition'

// The real cycle hiding behind use-limitbreak.ts's hasJustMaxed/
// hasJustExecuted booleans: charging -> maxed -> executing -> charging.
// Confirmed with synthfunc (2026-09-15) before building this:
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
// - The post-execution reset only actually reaches clients as of
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
  // the real execution audio ending moves this forward.
  executing: { 'audio:ended': 'charging' },
}

export function limitBreakReducer(phase: LimitBreakPhase, event: LimitBreakEvent): LimitBreakPhase {
  return transition(LIMITBREAK_TRANSITIONS, phase, event)
}
