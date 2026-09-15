import { describe, expect, test } from 'bun:test'

import {
  INITIAL_MIC_STATUS_STATE,
  MIC_CONNECTION_TRANSITIONS,
  MIC_MUTE_TRANSITIONS,
  micStatusReducer,
} from './mic-status'
import { toMermaid } from './mermaid'

describe('micStatusReducer', () => {
  test('starts unknown, then reflects the first status message', () => {
    const afterOpen = micStatusReducer(INITIAL_MIC_STATUS_STATE, 'connection:opened')
    expect(afterOpen).toEqual({ connection: 'connected', mute: 'unknown' })

    const afterStatus = micStatusReducer(afterOpen, 'mute:muted')
    expect(afterStatus).toEqual({ connection: 'connected', mute: 'muted' })
  })

  test('tracks mute toggles while connected', () => {
    let state = micStatusReducer(INITIAL_MIC_STATUS_STATE, 'connection:opened')
    state = micStatusReducer(state, 'mute:muted')
    state = micStatusReducer(state, 'mute:unmuted')
    expect(state.mute).toBe('unmuted')
  })

  // The correctness guarantee this machine exists for: a dropped connection
  // must never leave a stale mute value on screen.
  test('losing the connection resets mute to unknown, even mid-mute', () => {
    let state = micStatusReducer(INITIAL_MIC_STATUS_STATE, 'connection:opened')
    state = micStatusReducer(state, 'mute:muted')

    state = micStatusReducer(state, 'connection:closed')

    expect(state).toEqual({ connection: 'reconnecting', mute: 'unknown' })
  })

  test('reconnecting stays unknown until a fresh status arrives', () => {
    let state = micStatusReducer(INITIAL_MIC_STATUS_STATE, 'connection:opened')
    state = micStatusReducer(state, 'mute:unmuted')
    state = micStatusReducer(state, 'connection:closed')

    state = micStatusReducer(state, 'connection:retry')
    expect(state).toEqual({ connection: 'connecting', mute: 'unknown' })

    state = micStatusReducer(state, 'connection:opened')
    expect(state).toEqual({ connection: 'connected', mute: 'unknown' })
  })

  test('an event the current state does not list is ignored', () => {
    // 'connection:retry' means nothing to a 'connected' machine — it should hold position.
    const state = micStatusReducer({ connection: 'connected', mute: 'muted' }, 'connection:retry')
    expect(state).toEqual({ connection: 'connected', mute: 'muted' })
  })
})

describe('toMermaid', () => {
  test('renders the mic connection machine', () => {
    expect(toMermaid(MIC_CONNECTION_TRANSITIONS, 'connecting')).toBe(
      [
        'stateDiagram-v2',
        '    [*] --> connecting',
        '    connecting --> connected: connection:opened',
        '    connecting --> reconnecting: connection:closed',
        '    connected --> reconnecting: connection:closed',
        '    reconnecting --> connecting: connection:retry',
      ].join('\n'),
    )
  })

  test('renders the mic mute machine', () => {
    expect(toMermaid(MIC_MUTE_TRANSITIONS, 'unknown')).toBe(
      [
        'stateDiagram-v2',
        '    [*] --> unknown',
        '    unknown --> muted: mute:muted',
        '    unknown --> unmuted: mute:unmuted',
        '    muted --> unmuted: mute:unmuted',
        '    muted --> unknown: mute:reset',
        '    unmuted --> muted: mute:muted',
        '    unmuted --> unknown: mute:reset',
      ].join('\n'),
    )
  })
})
