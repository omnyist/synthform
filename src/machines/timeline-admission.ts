// Consumes the same event pool as alert-stack.ts, for a different job: not
// "show a card and dismiss it", but "when does this event become part of
// visible history". A different kind of thing than alert-lifecycle.ts on
// purpose, same kind of thing as alert-stack.ts — a collection-managing
// module, not a per-item Harel machine. Each item only ever has one real
// transition, and that's the whole point: this is the simpler one.
export interface PendingTimelineEntry<TEvent> {
  id: string
  event: TEvent
}

export interface TimelineAdmissionState<TEvent> {
  // Held back — a matching alert is still active, so this event hasn't
  // become history yet.
  pending: PendingTimelineEntry<TEvent>[]
  // Newest first, capped at maxVisible.
  visible: TEvent[]
  maxVisible: number
}

export function createTimelineAdmission<TEvent>(maxVisible: number): TimelineAdmissionState<TEvent> {
  return { pending: [], visible: [], maxVisible }
}

export type TimelineAdmissionAction<TEvent> =
  // A matching alert is currently active — hold this event out of view.
  | { type: 'timeline:queued'; id: string; event: TEvent }
  // No matching alert — nothing to wait on, straight to visible.
  | { type: 'timeline:admitted'; id: string; event: TEvent }
  // The matching alert finished (alert-stack's stack:reap, at the store
  // layer — this module never imports alert-stack.ts or knows it exists).
  | { type: 'timeline:released'; id: string }

export function timelineAdmissionReducer<TEvent>(
  state: TimelineAdmissionState<TEvent>,
  action: TimelineAdmissionAction<TEvent>,
): TimelineAdmissionState<TEvent> {
  switch (action.type) {
    case 'timeline:queued':
      return { ...state, pending: [...state.pending, { id: action.id, event: action.event }] }

    case 'timeline:admitted':
      return { ...state, visible: prepend(state.visible, action.event, state.maxVisible) }

    case 'timeline:released': {
      const entry = state.pending.find((p) => p.id === action.id)
      // Released for an id that was never held (no timeline:push arrived
      // for it, or it was already admitted directly) — a safe no-op, not
      // an error. Not every alert has a matching timeline event.
      if (!entry) return state

      return {
        ...state,
        pending: state.pending.filter((p) => p.id !== action.id),
        visible: prepend(state.visible, entry.event, state.maxVisible),
      }
    }
  }
}

function prepend<TEvent>(visible: TEvent[], event: TEvent, maxVisible: number): TEvent[] {
  return [event, ...visible].slice(0, maxVisible)
}
