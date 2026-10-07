import type { Transitions } from './transition'

// Renders a transition table as Mermaid's stateDiagram-v2 text — the diagram
// is generated from the same data the machine runs on, so it can't drift
// from the actual behavior the way a hand-drawn diagram would.
export function toMermaid<TState extends string>(
  transitions: Transitions<TState>,
  initial: TState,
): string {
  const lines = ['stateDiagram-v2', `    [*] --> ${initial}`]

  for (const [from, events] of Object.entries(transitions) as [
    TState,
    Partial<Record<string, TState>>,
  ][]) {
    for (const [event, to] of Object.entries(events)) {
      lines.push(`    ${from} --> ${to}: ${event}`)
    }
  }

  return lines.join('\n')
}
