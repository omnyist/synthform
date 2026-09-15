// A state machine as a plain lookup table: for each state, which events it
// accepts and where they lead. No guards, no actions — an event that needs
// to pick between two destinations (e.g. a mute payload) is split into two
// distinct event names by the caller before it reaches the table, so the
// table itself stays a flat, readable transition list.
export type Transitions<TState extends string> = Record<TState, Partial<Record<string, TState>>>

// An event the current state doesn't list is ignored — the machine stays
// put. There's no parent state to bubble to in a flat machine, so silently
// holding position is the correct default, not a gap.
export function transition<TState extends string>(
  transitions: Transitions<TState>,
  current: TState,
  event: string,
): TState {
  return transitions[current][event] ?? current
}
