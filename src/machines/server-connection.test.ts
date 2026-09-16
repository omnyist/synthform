import { describe, expect, test } from 'bun:test'

import { serverConnectionReducer, SERVER_CONNECTION_TRANSITIONS } from './server-connection'
import { toMermaid } from './mermaid'

describe('serverConnectionReducer', () => {
  test('a fresh connection goes disconnected -> connecting -> connected', () => {
    let phase = serverConnectionReducer('disconnected', 'connection:connect')
    expect(phase).toBe('connecting')

    phase = serverConnectionReducer(phase, 'connection:opened')
    expect(phase).toBe('connected')
  })

  test('losing an established connection moves to reconnecting, not disconnected', () => {
    const phase = serverConnectionReducer('connected', 'connection:closed')
    expect(phase).toBe('reconnecting')
  })

  test('a failed connection attempt also lands on reconnecting', () => {
    const phase = serverConnectionReducer('connecting', 'connection:closed')
    expect(phase).toBe('reconnecting')
  })

  test('the backoff timer retries from reconnecting back through connecting', () => {
    let phase = serverConnectionReducer('reconnecting', 'connection:connect')
    expect(phase).toBe('connecting')

    phase = serverConnectionReducer(phase, 'connection:opened')
    expect(phase).toBe('connected')
  })

  test('connection:disconnect is accepted from every state', () => {
    for (const phase of ['disconnected', 'connecting', 'connected', 'reconnecting'] as const) {
      expect(serverConnectionReducer(phase, 'connection:disconnect')).toBe('disconnected')
    }
  })

  test('connection:connect while already connecting or connected is a no-op', () => {
    expect(serverConnectionReducer('connecting', 'connection:connect')).toBe('connecting')
    expect(serverConnectionReducer('connected', 'connection:connect')).toBe('connected')
  })

  test('connection:opened outside connecting is ignored', () => {
    expect(serverConnectionReducer('disconnected', 'connection:opened')).toBe('disconnected')
    expect(serverConnectionReducer('reconnecting', 'connection:opened')).toBe('reconnecting')
  })
})

describe('toMermaid', () => {
  test('renders the server connection machine', () => {
    expect(toMermaid(SERVER_CONNECTION_TRANSITIONS, 'disconnected')).toBe(
      [
        'stateDiagram-v2',
        '    [*] --> disconnected',
        '    disconnected --> connecting: connection:connect',
        '    connecting --> connected: connection:opened',
        '    connecting --> reconnecting: connection:closed',
        '    connecting --> disconnected: connection:disconnect',
        '    connected --> reconnecting: connection:closed',
        '    connected --> disconnected: connection:disconnect',
        '    reconnecting --> connecting: connection:connect',
        '    reconnecting --> disconnected: connection:disconnect',
      ].join('\n'),
    )
  })
})
