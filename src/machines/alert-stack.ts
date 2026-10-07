import {
  alertLifecycleReducer,
  newAlertInstance,
  type AlertInstanceState,
  type AlertLifecycleEvent,
} from './alert-lifecycle'

// Owns concurrency for a stack of alert cards: how many of the per-card
// machines (alert-lifecycle.ts) are allowed to run at once, and the FIFO
// backlog of arrivals waiting for a free slot. A different kind of thing
// than alert-lifecycle.ts on purpose — that machine only ever answers
// "what phase is one card in"; this one answers "how many cards, which
// ones, in what order".
export interface StackInstance<TAlert> {
  id: string
  alert: TAlert
  lifecycle: AlertInstanceState
}

export interface AlertStackState<TAlert> {
  active: StackInstance<TAlert>[]
  backlog: Array<{ id: string; alert: TAlert }>
  // Injected, not read from the environment in here — this module stays
  // agnostic of Vite/env vars the same way alert-lifecycle.ts stays
  // agnostic of React. Whatever wires this up reads VITE_ALERT_STACK_MAX
  // (or similar) and passes the number in.
  maxConcurrent: number
}

export function createAlertStack<TAlert>(maxConcurrent: number): AlertStackState<TAlert> {
  return { active: [], backlog: [], maxConcurrent }
}

export type AlertStackAction<TAlert> =
  | { type: 'stack:arrive'; id: string; alert: TAlert }
  | { type: 'stack:lifecycle'; id: string; event: AlertLifecycleEvent }
  // Dispatched once the renderer's own exit animation for this card has
  // finished — a separate signal from the lifecycle reaching 'exiting',
  // which only means the exit animation should start.
  | { type: 'stack:reap'; id: string }

export function alertStackReducer<TAlert>(
  state: AlertStackState<TAlert>,
  action: AlertStackAction<TAlert>,
): AlertStackState<TAlert> {
  switch (action.type) {
    case 'stack:arrive':
      return admitFromBacklog({
        ...state,
        backlog: [...state.backlog, { id: action.id, alert: action.alert }],
      })

    case 'stack:lifecycle':
      return {
        ...state,
        active: state.active.map((instance) =>
          instance.id === action.id
            ? { ...instance, lifecycle: alertLifecycleReducer(instance.lifecycle, action.event) }
            : instance,
        ),
      }

    case 'stack:reap':
      return admitFromBacklog({
        ...state,
        active: state.active.filter((instance) => instance.id !== action.id),
      })
  }
}

// Fills every free slot in one pass — a reap that frees two slots at once
// (or a first arrival into an empty, previously-backlogged stack) admits
// as many as capacity allows immediately, rather than trickling in one
// per subsequent action.
function admitFromBacklog<TAlert>(state: AlertStackState<TAlert>): AlertStackState<TAlert> {
  let active = state.active
  let backlog = state.backlog

  while (active.length < state.maxConcurrent && backlog.length > 0) {
    const next = backlog[0]
    if (!next) break
    active = [...active, { id: next.id, alert: next.alert, lifecycle: newAlertInstance() }]
    backlog = backlog.slice(1)
  }

  return active === state.active && backlog === state.backlog
    ? state
    : { ...state, active, backlog }
}
