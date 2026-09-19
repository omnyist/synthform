import { createFileRoute } from '@tanstack/react-router'
import { useReducer, useState } from 'react'

import {
  micStatusReducer,
  INITIAL_MIC_STATUS_STATE,
  MIC_CONNECTION_TRANSITIONS,
  MIC_MUTE_TRANSITIONS,
  type MicStatusState,
  type MicStatusEvent,
} from '@/machines/mic-status'
import {
  alertLifecycleReducer,
  newAlertInstance,
  ALERT_LIFECYCLE_TRANSITIONS,
  type AlertInstanceState,
  type AlertLifecycleEvent,
} from '@/machines/alert-lifecycle'
import {
  limitBreakReducer,
  newLimitBreakState,
  LIMITBREAK_TRANSITIONS,
  type LimitBreakState,
  type LimitBreakEvent,
} from '@/machines/limitbreak'
import {
  serverConnectionReducer,
  SERVER_CONNECTION_TRANSITIONS,
  type ServerConnectionPhase,
  type ServerConnectionEvent,
} from '@/machines/server-connection'
import {
  whepReducer,
  WHEP_TRANSITIONS,
  type WhepPhase,
  type WhepEvent,
} from '@/machines/whep-connection'
import {
  timelineVisibilityReducer,
  TIMELINE_VISIBILITY_TRANSITIONS,
  type TimelineVisibilityPhase,
  type TimelineVisibilityEvent,
} from '@/machines/timeline-visibility'
import type { Transitions } from '@/machines/transition'

export const Route = createFileRoute('/debug/machines')({
  component: MachinesDebug,
})

// A sandbox, not a monitor — every panel below runs its reducer against
// local-only state, disconnected from the real store/socket/singletons.
// Reload the page to reset every panel back to its initial state.
//
// alert-stack.ts and timeline-admission.ts (the collection/backlog
// machines) already have their own live interactive page at
// /debug/alert-stack. emote-queue.ts has its own dev-only test buttons
// inside EmoteRain itself (Active/Backlog counts, "Spawn Test Emotes",
// "Emote Bomb!") wherever that component is mounted.

function TransitionTable<TState extends string>({ transitions }: { transitions: Transitions<TState> }) {
  const rows: { from: TState; event: string; to: TState }[] = []
  for (const [from, events] of Object.entries(transitions) as [TState, Partial<Record<string, TState>>][]) {
    for (const [event, to] of Object.entries(events)) {
      if (to) rows.push({ from, event, to: to as TState })
    }
  }

  return (
    <table className="w-full text-[10px]">
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="pr-2 py-0.5 text-gray-400">{r.from}</td>
            <td className="pr-2 py-0.5 text-gray-600">--{r.event}--&gt;</td>
            <td className="py-0.5 text-gray-400">{r.to}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MachinePanel<TState, TEvent extends string>({
  name,
  description,
  reducer,
  initial,
  events,
  renderState,
  transitions,
}: {
  name: string
  description: string
  reducer: (state: TState, event: TEvent) => TState
  initial: TState
  events: readonly TEvent[]
  renderState: (state: TState) => string
  transitions?: Transitions<string>
}) {
  const [state, dispatch] = useReducer(reducer, initial)
  const [log, setLog] = useState<TEvent[]>([])

  const handleDispatch = (event: TEvent) => {
    dispatch(event)
    setLog((prev) => [event, ...prev].slice(0, 6))
  }

  return (
    <div className="border border-gray-800 rounded bg-gray-950 p-4">
      <h2 className="text-sm font-bold text-gray-200">{name}</h2>
      <p className="mb-3 text-gray-500">{description}</p>

      <div className="mb-3">
        <span className="text-gray-500">state: </span>
        <span className="font-bold text-sky-400">{renderState(state)}</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {events.map((event) => (
          <button
            key={event}
            onClick={() => handleDispatch(event)}
            className="rounded bg-shark-800 px-2 py-1 text-[11px] text-gray-300 hover:bg-shark-700 active:bg-shark-600"
          >
            {event}
          </button>
        ))}
      </div>

      {log.length > 0 && (
        <div className="mb-3 text-[10px] text-gray-600">last: {[...log].reverse().join(' → ')}</div>
      )}

      {transitions && (
        <details>
          <summary className="cursor-pointer text-[10px] text-gray-600 hover:text-gray-400">
            transition table
          </summary>
          <div className="mt-1">
            <TransitionTable transitions={transitions} />
          </div>
        </details>
      )}
    </div>
  )
}

const MIC_STATUS_EVENTS: MicStatusEvent[] = [
  'connection:opened',
  'connection:closed',
  'connection:retry',
  'mute:muted',
  'mute:unmuted',
  'mute:reset',
]

const ALERT_LIFECYCLE_EVENTS: AlertLifecycleEvent[] = ['enter:complete', 'reveal:complete', 'audio:ended']

const LIMITBREAK_EVENTS: LimitBreakEvent[] = ['bars:maxed', 'limitbreak:executed', 'audio:ended']

const SERVER_CONNECTION_EVENTS: ServerConnectionEvent[] = [
  'connection:connect',
  'connection:opened',
  'connection:closed',
  'connection:disconnect',
]

const WHEP_EVENTS: WhepEvent[] = ['whep:connect', 'whep:track', 'whep:failed', 'whep:reset']

const TIMELINE_VISIBILITY_EVENTS: TimelineVisibilityEvent[] = ['timeline:pushed', 'timeline:idle']

function MachinesDebug() {
  return (
    <div className="min-h-screen bg-black p-6 font-mono text-xs text-white">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl text-chalk">Machines Debug</h1>
        <p className="text-gray-500">
          Click an event to dispatch it against that machine's own reducer. Buttons list every event the
          machine knows about, not just the ones valid from the current state — an invalid one is a
          visible no-op, which is the point: unhandled events hold position by design. Reload to reset.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MachinePanel<MicStatusState, MicStatusEvent>
          name="mic-status"
          description="Connection lifecycle + last-known mute, from synthmult's audio channel."
          reducer={micStatusReducer}
          initial={INITIAL_MIC_STATUS_STATE}
          events={MIC_STATUS_EVENTS}
          renderState={(s) => `${s.connection} / ${s.mute}`}
          transitions={{ ...MIC_CONNECTION_TRANSITIONS, ...MIC_MUTE_TRANSITIONS } as Transitions<string>}
        />

        <MachinePanel<AlertInstanceState, AlertLifecycleEvent>
          name="alert-lifecycle"
          description="One alert card's own life — entering, revealing, holding for audio, exiting."
          reducer={alertLifecycleReducer}
          initial={newAlertInstance()}
          events={ALERT_LIFECYCLE_EVENTS}
          renderState={(s) => `${s.phase}${s.audioEndedEarly ? ' (audio ended early, pending)' : ''}`}
          transitions={ALERT_LIFECYCLE_TRANSITIONS as Transitions<string>}
        />

        <MachinePanel<LimitBreakState, LimitBreakEvent>
          name="limitbreak"
          description="Charging / maxed / executing, remembering a re-max that arrives mid-execution."
          reducer={limitBreakReducer}
          initial={newLimitBreakState()}
          events={LIMITBREAK_EVENTS}
          renderState={(s) => `${s.phase}${s.maxedDuringExecuting ? ' (re-max pending)' : ''}`}
          transitions={LIMITBREAK_TRANSITIONS as Transitions<string>}
        />

        <MachinePanel<ServerConnectionPhase, ServerConnectionEvent>
          name="server-connection"
          description="The main synthfunc socket's lifecycle. Sandboxed here — this does not touch the real connection."
          reducer={serverConnectionReducer}
          initial="disconnected"
          events={SERVER_CONNECTION_EVENTS}
          renderState={(s) => s}
          transitions={SERVER_CONNECTION_TRANSITIONS as Transitions<string>}
        />

        <MachinePanel<WhepPhase, WhepEvent>
          name="whep-connection"
          description="The telestrator's WHEP/WebRTC feed. Sandboxed — not the real peer connection."
          reducer={whepReducer}
          initial="idle"
          events={WHEP_EVENTS}
          renderState={(s) => s}
          transitions={WHEP_TRANSITIONS as Transitions<string>}
        />

        <MachinePanel<TimelineVisibilityPhase, TimelineVisibilityEvent>
          name="timeline-visibility"
          description="Timeline widget show/hide, driven by activity and an idle timeout."
          reducer={timelineVisibilityReducer}
          initial="hidden"
          events={TIMELINE_VISIBILITY_EVENTS}
          renderState={(s) => s}
          transitions={TIMELINE_VISIBILITY_TRANSITIONS as Transitions<string>}
        />
      </div>
    </div>
  )
}
