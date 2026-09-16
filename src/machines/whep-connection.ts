import { transition, type Transitions } from './transition'

// use-whep.ts's WHEP/WebRTC feed lifecycle — the telestrator's live feed of
// OBS program out. Backoff-and-retry timing stays entirely in use-whep.ts,
// same split as every other machine here (mic-status.ts, server-connection.ts):
// this only names the phases one connection attempt visits, never how long
// it waits before the next.
export type WhepPhase = 'idle' | 'connecting' | 'live' | 'error'

export type WhepEvent =
  | 'whep:connect'
  | 'whep:track'
  | 'whep:failed'
  // Accepted from every phase, including 'idle' itself (already a no-op
  // there by default) — the url going null, or the hook unmounting, must
  // always land regardless of what attempt it happened to interrupt.
  | 'whep:reset'

export const WHEP_TRANSITIONS: Transitions<WhepPhase> = {
  idle: { 'whep:connect': 'connecting' },
  connecting: {
    'whep:track': 'live',
    'whep:failed': 'error',
    'whep:reset': 'idle',
  },
  live: {
    'whep:failed': 'error',
    'whep:reset': 'idle',
  },
  error: {
    // The backoff timer's retry attempt — same action a first-ever connect
    // takes, just entered from 'error' instead of 'idle'.
    'whep:connect': 'connecting',
    'whep:reset': 'idle',
  },
}

export function whepReducer(phase: WhepPhase, event: WhepEvent): WhepPhase {
  return transition(WHEP_TRANSITIONS, phase, event)
}
