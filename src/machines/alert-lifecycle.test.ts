import { describe, expect, test } from 'bun:test'

import { alertLifecycleReducer, newAlertInstance } from './alert-lifecycle'

describe('alertLifecycleReducer', () => {
  test('runs the normal sequence end to end', () => {
    let state = newAlertInstance()
    expect(state).toEqual({ phase: 'entering', audioEndedEarly: false })

    state = alertLifecycleReducer(state, 'enter:complete')
    expect(state).toEqual({ phase: 'revealing', audioEndedEarly: false })

    state = alertLifecycleReducer(state, 'reveal:complete')
    expect(state).toEqual({ phase: 'holding', audioEndedEarly: false })

    state = alertLifecycleReducer(state, 'audio:ended')
    expect(state).toEqual({ phase: 'exiting', audioEndedEarly: false })
  })

  // The guarantee this machine exists for: a short sting finishing before
  // the entrance animation must never cut the reveal off mid-flourish.
  test('audio ending during entering is remembered, not dropped', () => {
    let state = newAlertInstance()
    state = alertLifecycleReducer(state, 'audio:ended')
    expect(state).toEqual({ phase: 'entering', audioEndedEarly: true })

    // Still revealing — the early flag must survive this transition too.
    state = alertLifecycleReducer(state, 'enter:complete')
    expect(state).toEqual({ phase: 'revealing', audioEndedEarly: true })

    // Reveal finishes — jumps straight to exiting, holding is never exposed.
    state = alertLifecycleReducer(state, 'reveal:complete')
    expect(state).toEqual({ phase: 'exiting', audioEndedEarly: false })
  })

  test('audio ending during revealing is also remembered', () => {
    let state = alertLifecycleReducer(newAlertInstance(), 'enter:complete')
    state = alertLifecycleReducer(state, 'audio:ended')
    expect(state).toEqual({ phase: 'revealing', audioEndedEarly: true })

    state = alertLifecycleReducer(state, 'reveal:complete')
    expect(state).toEqual({ phase: 'exiting', audioEndedEarly: false })
  })

  test('an unrelated event does not clear a pending early-audio flag', () => {
    let state = newAlertInstance()
    state = alertLifecycleReducer(state, 'audio:ended')
    expect(state.audioEndedEarly).toBe(true)

    // 'reveal:complete' means nothing to 'entering' — must hold position
    // AND must not silently clear the remembered flag.
    state = alertLifecycleReducer(state, 'reveal:complete')
    expect(state).toEqual({ phase: 'entering', audioEndedEarly: true })
  })

  test('audio ending normally from holding needs no memory', () => {
    let state = newAlertInstance()
    state = alertLifecycleReducer(state, 'enter:complete')
    state = alertLifecycleReducer(state, 'reveal:complete')
    state = alertLifecycleReducer(state, 'audio:ended')
    expect(state).toEqual({ phase: 'exiting', audioEndedEarly: false })
  })

  test('exiting is terminal within this machine', () => {
    let state = newAlertInstance()
    state = alertLifecycleReducer(state, 'enter:complete')
    state = alertLifecycleReducer(state, 'reveal:complete')
    state = alertLifecycleReducer(state, 'audio:ended')
    state = alertLifecycleReducer(state, 'enter:complete')
    expect(state).toEqual({ phase: 'exiting', audioEndedEarly: false })
  })
})
