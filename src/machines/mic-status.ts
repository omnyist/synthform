import { transition, type Transitions } from './transition'

// The synthmult WebSocket's own lifecycle (see lib/mic-status-adapter.ts).
// Reconnects forever on close, backing off up to 30s — this machine doesn't
// add a "gave up" state, it just names the states that loop already has.
export type MicConnectionState = 'connecting' | 'connected' | 'reconnecting'
export type MicConnectionEvent = 'connection:opened' | 'connection:closed' | 'connection:retry'

export const MIC_CONNECTION_TRANSITIONS: Transitions<MicConnectionState> = {
  connecting: { 'connection:opened': 'connected', 'connection:closed': 'reconnecting' },
  connected: { 'connection:closed': 'reconnecting' },
  reconnecting: { 'connection:retry': 'connecting' },
}

// What synthmix last told us, via synthmult's audio channel. `unknown` is a
// real state, not a fallback to `false` — a widget that can't tell you it
// doesn't know yet is a widget that lies once, silently, on every startup.
export type MicMuteState = 'unknown' | 'muted' | 'unmuted'
export type MicMuteEvent = 'mute:muted' | 'mute:unmuted' | 'mute:reset'

export const MIC_MUTE_TRANSITIONS: Transitions<MicMuteState> = {
  unknown: { 'mute:muted': 'muted', 'mute:unmuted': 'unmuted' },
  muted: { 'mute:unmuted': 'unmuted', 'mute:reset': 'unknown' },
  unmuted: { 'mute:muted': 'muted', 'mute:reset': 'unknown' },
}

export interface MicStatusState {
  connection: MicConnectionState
  mute: MicMuteState
}

export const INITIAL_MIC_STATUS_STATE: MicStatusState = {
  connection: 'connecting',
  mute: 'unknown',
}

export type MicStatusEvent = MicConnectionEvent | MicMuteEvent

// Losing the connection resets mute status back to unknown. This is the
// correctness guarantee the widget needs: it must never show a mute value
// that could already be wrong, so as soon as the connection that value came
// from is gone, so is the value — regardless of how fast synthmult replays
// the last-known state on reconnect.
export function micStatusReducer(state: MicStatusState, event: MicStatusEvent): MicStatusState {
  if (event === 'mute:muted' || event === 'mute:unmuted') {
    return { ...state, mute: transition(MIC_MUTE_TRANSITIONS, state.mute, event) }
  }

  const connection = transition(MIC_CONNECTION_TRANSITIONS, state.connection, event)
  const mute =
    connection === 'reconnecting' ? transition(MIC_MUTE_TRANSITIONS, state.mute, 'mute:reset') : state.mute

  return { connection, mute }
}
