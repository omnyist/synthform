import { describe, expect, test } from 'bun:test'

import { limitBreakReducer, newLimitBreakState } from './limitbreak'

describe('limitBreakReducer', () => {
  test('runs the normal cycle end to end', () => {
    let state = limitBreakReducer(newLimitBreakState(), 'bars:maxed')
    expect(state).toEqual({ phase: 'maxed', maxedDuringExecuting: false })

    state = limitBreakReducer(state, 'limitbreak:executed')
    expect(state).toEqual({ phase: 'executing', maxedDuringExecuting: false })

    state = limitBreakReducer(state, 'audio:ended')
    expect(state).toEqual({ phase: 'charging', maxedDuringExecuting: false })
  })

  // The connect-window race synthfunc confirmed: a client can see
  // 'executed' before it has ever observed a maxed update.
  test('executed is accepted from charging directly, not only maxed', () => {
    const state = limitBreakReducer(newLimitBreakState(), 'limitbreak:executed')
    expect(state).toEqual({ phase: 'executing', maxedDuringExecuting: false })
  })

  // isMaxed is level-triggered — repeated bars:maxed while already maxed
  // must not do anything surprising.
  test('bars:maxed while already maxed is a no-op', () => {
    const state = limitBreakReducer({ phase: 'maxed', maxedDuringExecuting: false }, 'bars:maxed')
    expect(state).toEqual({ phase: 'maxed', maxedDuringExecuting: false })
  })

  // The decision: a double-fire is ignored, the current pulse finishes on
  // its own via audio:ended. No special-casing — this falls out of the
  // transition table simply having no entry for it.
  test('a double-fire of executed while already executing is ignored', () => {
    const state = limitBreakReducer(
      { phase: 'executing', maxedDuringExecuting: false },
      'limitbreak:executed',
    )
    expect(state).toEqual({ phase: 'executing', maxedDuringExecuting: false })
  })

  // The fix this file exists for: a new redemption re-crossing the
  // threshold mid-execution must not preempt the current pulse, but the
  // signal must not be lost either — it has to surface the instant we're
  // back in charging, not get reconstructed later from raw data.
  test('a re-max during executing is remembered and replayed on exit, not lost', () => {
    let state = limitBreakReducer(newLimitBreakState(), 'bars:maxed')
    state = limitBreakReducer(state, 'limitbreak:executed')
    expect(state.phase).toBe('executing')

    // Queue re-crosses the threshold while the sound is still playing.
    state = limitBreakReducer(state, 'bars:maxed')
    expect(state).toEqual({ phase: 'executing', maxedDuringExecuting: true })

    // Audio finishes — goes straight to 'maxed', 'charging' is never
    // exposed since it was already stale the instant it would have
    // appeared.
    state = limitBreakReducer(state, 'audio:ended')
    expect(state).toEqual({ phase: 'maxed', maxedDuringExecuting: false })
  })

  // An unrelated event arriving mid-execution must not silently clear a
  // pending re-max — same guarantee alert-lifecycle.ts's audioEndedEarly
  // has against an unrelated event.
  test('a pending re-max survives an unrelated ignored event', () => {
    let state = limitBreakReducer(newLimitBreakState(), 'bars:maxed')
    state = limitBreakReducer(state, 'limitbreak:executed')
    state = limitBreakReducer(state, 'bars:maxed')
    expect(state.maxedDuringExecuting).toBe(true)

    // A double-fired executed while executing is ignored — must not
    // clear the pending flag either.
    state = limitBreakReducer(state, 'limitbreak:executed')
    expect(state).toEqual({ phase: 'executing', maxedDuringExecuting: true })
  })

  test('without a re-max, audio:ended goes to charging normally', () => {
    let state = limitBreakReducer(newLimitBreakState(), 'bars:maxed')
    state = limitBreakReducer(state, 'limitbreak:executed')
    state = limitBreakReducer(state, 'audio:ended')
    expect(state).toEqual({ phase: 'charging', maxedDuringExecuting: false })
  })
})
