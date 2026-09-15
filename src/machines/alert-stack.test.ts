import { describe, expect, test } from 'bun:test'

import { alertStackReducer, createAlertStack, type AlertStackState } from './alert-stack'

interface TestAlert {
  type: string
}

function arrive(id: string) {
  return { type: 'stack:arrive' as const, id, alert: { type: 'follow' } as TestAlert }
}

describe('alertStackReducer', () => {
  test('admits immediately while under capacity', () => {
    let state = createAlertStack<TestAlert>(2)
    state = alertStackReducer(state, arrive('a'))

    expect(state.active.map((i) => i.id)).toEqual(['a'])
    expect(state.backlog).toEqual([])
    expect(state.active[0]?.lifecycle).toEqual({ phase: 'entering', audioEndedEarly: false })
  })

  test('queues arrivals once at capacity, FIFO', () => {
    let state = createAlertStack<TestAlert>(1)
    state = alertStackReducer(state, arrive('a'))
    state = alertStackReducer(state, arrive('b'))
    state = alertStackReducer(state, arrive('c'))

    expect(state.active.map((i) => i.id)).toEqual(['a'])
    expect(state.backlog.map((b) => b.id)).toEqual(['b', 'c'])
  })

  test('reaping a completed card admits the next backlog item', () => {
    let state = createAlertStack<TestAlert>(1)
    state = alertStackReducer(state, arrive('a'))
    state = alertStackReducer(state, arrive('b'))

    state = alertStackReducer(state, { type: 'stack:reap', id: 'a' })

    expect(state.active.map((i) => i.id)).toEqual(['b'])
    expect(state.backlog).toEqual([])
  })

  test('a single action fills every free slot, not just one', () => {
    let state: AlertStackState<TestAlert> = {
      active: [],
      backlog: [
        { id: 'a', alert: { type: 'follow' } },
        { id: 'b', alert: { type: 'follow' } },
        { id: 'c', alert: { type: 'follow' } },
      ],
      maxConcurrent: 3,
    }

    state = alertStackReducer(state, arrive('d'))

    expect(state.active.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(state.backlog.map((b) => b.id)).toEqual(['d'])
  })

  test('maxConcurrent 1 behaves like a strict one-at-a-time queue', () => {
    let state = createAlertStack<TestAlert>(1)
    state = alertStackReducer(state, arrive('a'))
    state = alertStackReducer(state, arrive('b'))
    expect(state.active.map((i) => i.id)).toEqual(['a'])

    state = alertStackReducer(state, { type: 'stack:reap', id: 'a' })
    expect(state.active.map((i) => i.id)).toEqual(['b'])
    expect(state.backlog).toEqual([])
  })

  test('lifecycle events route to the targeted instance only', () => {
    let state = createAlertStack<TestAlert>(2)
    state = alertStackReducer(state, arrive('a'))
    state = alertStackReducer(state, arrive('b'))

    state = alertStackReducer(state, { type: 'stack:lifecycle', id: 'a', event: 'enter:complete' })

    expect(state.active.find((i) => i.id === 'a')?.lifecycle.phase).toBe('revealing')
    expect(state.active.find((i) => i.id === 'b')?.lifecycle.phase).toBe('entering')
  })
})
