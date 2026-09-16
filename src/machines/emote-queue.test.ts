import { describe, expect, test } from 'bun:test'

import { createEmoteQueue, emoteQueueReducer, type EmoteQueueState } from './emote-queue'

function arrive(id: string, emoteId = 'emotesv2_test') {
  return { type: 'queue:arrive' as const, id, emoteId }
}

describe('emoteQueueReducer', () => {
  test('admits immediately while under capacity', () => {
    let state = createEmoteQueue(2)
    state = emoteQueueReducer(state, arrive('a'))

    expect(state.active.map((e) => e.id)).toEqual(['a'])
    expect(state.backlog).toEqual([])
  })

  test('queues arrivals once at capacity, FIFO', () => {
    let state = createEmoteQueue(1)
    state = emoteQueueReducer(state, arrive('a'))
    state = emoteQueueReducer(state, arrive('b'))
    state = emoteQueueReducer(state, arrive('c'))

    expect(state.active.map((e) => e.id)).toEqual(['a'])
    expect(state.backlog.map((e) => e.id)).toEqual(['b', 'c'])
  })

  test('reaping a fallen emote admits the next backlog entry', () => {
    let state = createEmoteQueue(1)
    state = emoteQueueReducer(state, arrive('a'))
    state = emoteQueueReducer(state, arrive('b'))

    state = emoteQueueReducer(state, { type: 'queue:reap', id: 'a' })

    expect(state.active.map((e) => e.id)).toEqual(['b'])
    expect(state.backlog).toEqual([])
  })

  test('a single reap fills every free slot, not just one', () => {
    let state: EmoteQueueState = {
      active: [],
      backlog: [
        { id: 'a', emoteId: 'emotesv2_a' },
        { id: 'b', emoteId: 'emotesv2_b' },
        { id: 'c', emoteId: 'emotesv2_c' },
      ],
      maxConcurrent: 3,
    }

    state = emoteQueueReducer(state, arrive('d'))

    expect(state.active.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(state.backlog.map((e) => e.id)).toEqual(['d'])
  })

  test('reaping an id not in active is a no-op', () => {
    let state = createEmoteQueue(2)
    state = emoteQueueReducer(state, arrive('a'))

    state = emoteQueueReducer(state, { type: 'queue:reap', id: 'ghost' })

    expect(state.active.map((e) => e.id)).toEqual(['a'])
    expect(state.backlog).toEqual([])
  })

  test('preserves emoteId through the backlog into active', () => {
    let state = createEmoteQueue(1)
    state = emoteQueueReducer(state, arrive('a', 'emotesv2_first'))
    state = emoteQueueReducer(state, arrive('b', 'emotesv2_second'))

    state = emoteQueueReducer(state, { type: 'queue:reap', id: 'a' })

    expect(state.active).toEqual([{ id: 'b', emoteId: 'emotesv2_second' }])
  })
})
