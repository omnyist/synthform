import { transition, type Transitions } from './transition'

// use-server.ts's ServerConnection WebSocket lifecycle — the main synthfunc
// overlay socket every route depends on. Reconnects forever with
// exponential backoff (use-server.ts owns the timer/delay itself, same
// separation as mic-status.ts's connection machine: this file only names
// the phases that loop already visits, never how long it waits).
//
// 'reconnecting' is the point of building this: the old code had one
// Disconnected value standing for both "never connected yet" and "just
// lost the connection, retrying in the background" — the exact ambiguity
// mic-status.ts's connection machine already fixed for the mic status
// socket. Splitting them means a caller can finally tell "idle, nobody's
// tried yet" from "down, but actively working on it" without guessing from
// side channels like reconnectAttempts.
export type ServerConnectionPhase = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export type ServerConnectionEvent =
  | 'connection:connect'
  | 'connection:opened'
  | 'connection:closed'
  // Accepted from every state, including 'disconnected' itself (already a
  // no-op there by default) — an explicit stop must always land, not get
  // silently dropped depending on what state it happened to interrupt.
  | 'connection:disconnect'

export const SERVER_CONNECTION_TRANSITIONS: Transitions<ServerConnectionPhase> = {
  disconnected: { 'connection:connect': 'connecting' },
  connecting: {
    'connection:opened': 'connected',
    'connection:closed': 'reconnecting',
    'connection:disconnect': 'disconnected',
  },
  connected: {
    'connection:closed': 'reconnecting',
    'connection:disconnect': 'disconnected',
  },
  reconnecting: {
    // The backoff timer's own signal to try again — named 'connect' rather
    // than 'retry' because it drives the exact same action a first-ever
    // connect() call does; scheduleReconnect() just calls connect() again.
    'connection:connect': 'connecting',
    'connection:disconnect': 'disconnected',
  },
}

export function serverConnectionReducer(
  phase: ServerConnectionPhase,
  event: ServerConnectionEvent,
): ServerConnectionPhase {
  return transition(SERVER_CONNECTION_TRANSITIONS, phase, event)
}
