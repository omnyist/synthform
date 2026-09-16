// Owns concurrency and backlog for EmoteRain's simulation slots: how many
// emotes are allowed to be live in the Matter.js world at once, and the
// FIFO backlog of arrivals waiting for a free slot. Same admission concern
// as alert-stack.ts, minus that machine's per-instance lifecycle sub-machine
// — an emote has no phases to speak of (entering/holding/exiting), it's
// just a physics body until it falls off screen, and that simulation is
// entirely components/effects/emote-rain.tsx's business. This machine only
// ever answers "how many, which ones, in what order".
export interface EmoteQueueEntry {
  id: string
  emoteId: string
}

export interface EmoteQueueState {
  active: EmoteQueueEntry[]
  backlog: EmoteQueueEntry[]
  // Injected, not read from the environment in here — same reasoning as
  // alert-stack.ts's maxConcurrent: whatever wires this up reads the real
  // config value and passes the number in.
  maxConcurrent: number
}

export function createEmoteQueue(maxConcurrent: number): EmoteQueueState {
  return { active: [], backlog: [], maxConcurrent }
}

export type EmoteQueueAction =
  | { type: 'queue:arrive'; id: string; emoteId: string }
  // Dispatched once the emote's body has actually left the simulation (fell
  // off screen) — a separate signal from the 45s timer that merely disables
  // its collision so it starts falling, mirroring how alert-stack.ts's
  // stack:reap is a separate signal from the lifecycle reaching 'exiting'.
  | { type: 'queue:reap'; id: string }

export function emoteQueueReducer(state: EmoteQueueState, action: EmoteQueueAction): EmoteQueueState {
  switch (action.type) {
    case 'queue:arrive':
      return admitFromBacklog({
        ...state,
        backlog: [...state.backlog, { id: action.id, emoteId: action.emoteId }],
      })

    case 'queue:reap':
      return admitFromBacklog({
        ...state,
        active: state.active.filter((entry) => entry.id !== action.id),
      })
  }
}

// Fills every free slot in one pass — a reap that frees several slots at
// once admits as many backlog entries as capacity allows immediately,
// rather than trickling in one per subsequent action.
function admitFromBacklog(state: EmoteQueueState): EmoteQueueState {
  let active = state.active
  let backlog = state.backlog

  while (active.length < state.maxConcurrent && backlog.length > 0) {
    const next = backlog[0]
    if (!next) break
    active = [...active, next]
    backlog = backlog.slice(1)
  }

  return active === state.active && backlog === state.backlog ? state : { ...state, active, backlog }
}
