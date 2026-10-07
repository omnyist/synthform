import { describe, expect, test } from 'bun:test'

import { timelineVisibilityReducer, TIMELINE_VISIBILITY_TRANSITIONS } from './timeline-visibility'
import { toMermaid } from './mermaid'

describe('timelineVisibilityReducer', () => {
  test('a push while hidden reveals the timeline', () => {
    expect(timelineVisibilityReducer('hidden', 'timeline:pushed')).toBe('visible')
  })

  test('a further push while already visible is a no-op for the phase', () => {
    expect(timelineVisibilityReducer('visible', 'timeline:pushed')).toBe('visible')
  })

  test('idling out while visible hides it', () => {
    expect(timelineVisibilityReducer('visible', 'timeline:idle')).toBe('hidden')
  })

  test('timeline:idle while already hidden is a no-op', () => {
    expect(timelineVisibilityReducer('hidden', 'timeline:idle')).toBe('hidden')
  })
})

describe('toMermaid', () => {
  test('renders the timeline visibility machine', () => {
    expect(toMermaid(TIMELINE_VISIBILITY_TRANSITIONS, 'hidden')).toBe(
      [
        'stateDiagram-v2',
        '    [*] --> hidden',
        '    hidden --> visible: timeline:pushed',
        '    visible --> hidden: timeline:idle',
      ].join('\n'),
    )
  })
})
