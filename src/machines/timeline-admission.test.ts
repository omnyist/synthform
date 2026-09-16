import { describe, expect, test } from 'bun:test'

import {
  createTimelineAdmission,
  timelineAdmissionReducer,
  type TimelineAdmissionState,
} from './timeline-admission'

interface TestEvent {
  label: string
}

describe('timelineAdmissionReducer', () => {
  test('a queued event stays out of visible until released', () => {
    let state = createTimelineAdmission<TestEvent>(20)
    state = timelineAdmissionReducer(state, { type: 'timeline:queued', id: 'a', event: { label: 'a' } })

    expect(state.visible).toEqual([])
    expect(state.pending.map((p) => p.id)).toEqual(['a'])
  })

  test('an admitted event goes straight to visible', () => {
    let state = createTimelineAdmission<TestEvent>(20)
    state = timelineAdmissionReducer(state, { type: 'timeline:admitted', id: 'a', event: { label: 'a' } })

    expect(state.visible).toEqual([{ label: 'a' }])
    expect(state.pending).toEqual([])
  })

  test('releasing a queued event moves it into visible', () => {
    let state = createTimelineAdmission<TestEvent>(20)
    state = timelineAdmissionReducer(state, { type: 'timeline:queued', id: 'a', event: { label: 'a' } })
    state = timelineAdmissionReducer(state, { type: 'timeline:released', id: 'a' })

    expect(state.visible).toEqual([{ label: 'a' }])
    expect(state.pending).toEqual([])
  })

  // Not every reaped alert has a matching timeline event (suppressed
  // gift-sub events, or one that was already admitted directly).
  test('releasing an unknown id is a safe no-op', () => {
    let state = createTimelineAdmission<TestEvent>(20)
    state = timelineAdmissionReducer(state, { type: 'timeline:admitted', id: 'a', event: { label: 'a' } })

    const before = state
    state = timelineAdmissionReducer(state, { type: 'timeline:released', id: 'never-held' })

    expect(state).toBe(before)
  })

  test('visible is newest first', () => {
    let state = createTimelineAdmission<TestEvent>(20)
    state = timelineAdmissionReducer(state, { type: 'timeline:admitted', id: 'a', event: { label: 'a' } })
    state = timelineAdmissionReducer(state, { type: 'timeline:admitted', id: 'b', event: { label: 'b' } })

    expect(state.visible).toEqual([{ label: 'b' }, { label: 'a' }])
  })

  test('visible respects maxVisible', () => {
    let state: TimelineAdmissionState<TestEvent> = createTimelineAdmission<TestEvent>(2)
    state = timelineAdmissionReducer(state, { type: 'timeline:admitted', id: 'a', event: { label: 'a' } })
    state = timelineAdmissionReducer(state, { type: 'timeline:admitted', id: 'b', event: { label: 'b' } })
    state = timelineAdmissionReducer(state, { type: 'timeline:admitted', id: 'c', event: { label: 'c' } })

    expect(state.visible).toEqual([{ label: 'c' }, { label: 'b' }])
  })

  test('multiple pending events release independently', () => {
    let state = createTimelineAdmission<TestEvent>(20)
    state = timelineAdmissionReducer(state, { type: 'timeline:queued', id: 'a', event: { label: 'a' } })
    state = timelineAdmissionReducer(state, { type: 'timeline:queued', id: 'b', event: { label: 'b' } })

    state = timelineAdmissionReducer(state, { type: 'timeline:released', id: 'a' })

    expect(state.visible).toEqual([{ label: 'a' }])
    expect(state.pending.map((p) => p.id)).toEqual(['b'])
  })
})
