import { describe, expect, test } from 'bun:test'

import { limitBreakReducer } from './limitbreak'

describe('limitBreakReducer', () => {
  test('runs the normal cycle end to end', () => {
    let phase = limitBreakReducer('charging', 'bars:maxed')
    expect(phase).toBe('maxed')

    phase = limitBreakReducer(phase, 'limitbreak:executed')
    expect(phase).toBe('executing')

    phase = limitBreakReducer(phase, 'audio:ended')
    expect(phase).toBe('charging')
  })

  // The connect-window race synthfunc confirmed: a client can see
  // 'executed' before it has ever observed a maxed update.
  test('executed is accepted from charging directly, not only maxed', () => {
    const phase = limitBreakReducer('charging', 'limitbreak:executed')
    expect(phase).toBe('executing')
  })

  // isMaxed is level-triggered — repeated bars:maxed while already maxed
  // must not do anything surprising.
  test('bars:maxed while already maxed is a no-op', () => {
    const phase = limitBreakReducer('maxed', 'bars:maxed')
    expect(phase).toBe('maxed')
  })

  // The decision: a double-fire is ignored, the current pulse finishes on
  // its own via audio:ended. No special-casing — this falls out of the
  // transition table simply having no entry for it.
  test('a double-fire of executed while already executing is ignored', () => {
    const phase = limitBreakReducer('executing', 'limitbreak:executed')
    expect(phase).toBe('executing')
  })

  // A new redemption re-crossing the threshold shouldn't preempt the
  // current execution's audio/animation.
  test('bars:maxed while executing does not preempt the current pulse', () => {
    const phase = limitBreakReducer('executing', 'bars:maxed')
    expect(phase).toBe('executing')
  })
})
