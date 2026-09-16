import { describe, expect, test } from 'bun:test'

import { whepReducer, WHEP_TRANSITIONS } from './whep-connection'
import { toMermaid } from './mermaid'

describe('whepReducer', () => {
  test('a fresh attempt goes idle -> connecting -> live', () => {
    let phase = whepReducer('idle', 'whep:connect')
    expect(phase).toBe('connecting')

    phase = whepReducer(phase, 'whep:track')
    expect(phase).toBe('live')
  })

  test('a failed attempt before any track lands on error', () => {
    expect(whepReducer('connecting', 'whep:failed')).toBe('error')
  })

  test('a live feed dropping also lands on error', () => {
    expect(whepReducer('live', 'whep:failed')).toBe('error')
  })

  test('the backoff timer retries from error back through connecting', () => {
    let phase = whepReducer('error', 'whep:connect')
    expect(phase).toBe('connecting')

    phase = whepReducer(phase, 'whep:track')
    expect(phase).toBe('live')
  })

  test('whep:reset is accepted from every phase', () => {
    for (const phase of ['idle', 'connecting', 'live', 'error'] as const) {
      expect(whepReducer(phase, 'whep:reset')).toBe('idle')
    }
  })

  test('whep:track outside connecting is ignored', () => {
    expect(whepReducer('idle', 'whep:track')).toBe('idle')
    expect(whepReducer('error', 'whep:track')).toBe('error')
  })
})

describe('toMermaid', () => {
  test('renders the whep connection machine', () => {
    expect(toMermaid(WHEP_TRANSITIONS, 'idle')).toBe(
      [
        'stateDiagram-v2',
        '    [*] --> idle',
        '    idle --> connecting: whep:connect',
        '    connecting --> live: whep:track',
        '    connecting --> error: whep:failed',
        '    connecting --> idle: whep:reset',
        '    live --> error: whep:failed',
        '    live --> idle: whep:reset',
        '    error --> connecting: whep:connect',
        '    error --> idle: whep:reset',
      ].join('\n'),
    )
  })
})
