import { createFileRoute } from '@tanstack/react-router'
import { useRealtimeStore } from '@/store/realtime'
import { serverConnection } from '@/hooks/use-server'
import { useIronMONStats, useIronMONRuns } from '@/hooks/use-questlog'
import { useState, useEffect, useCallback } from 'react'
import type { MessageType } from '@/types/server'

export const Route = createFileRoute('/debug/ironmon')({
  component: IronMONDebug,
})

const IRONMON_TYPES: MessageType[] = [
  'ironmon:init',
  'ironmon:seed',
  'ironmon:checkpoint',
  'ironmon:location',
  'ironmon:battle_started',
  'ironmon:battle_ended',
  'ironmon:team_update',
  'ironmon:item_usage',
  'ironmon:healing_summary',
  'ironmon:trainer_defeated',
  'ironmon:encounter',
  'ironmon:battle_damage',
  'ironmon:battle_action',
  'ironmon:move_history',
  'ironmon:move_effectiveness',
  'ironmon:reset',
  'ironmon:error',
]

function IronMONDebug() {
  const { data: stats, isLoading: statsLoading } = useIronMONStats('kaizo')
  const { data: runs, isLoading: runsLoading } = useIronMONRuns('kaizo', 20)

  const isConnected = useRealtimeStore((s) => s.isConnected)
  const [events, setEvents] = useState<Array<{ type: string; data: any; timestamp: string }>>([])

  // Stable callback for event logging
  const handleMessage = useCallback((messageType: string, payload: unknown) => {
    const timestamp = new Date().toLocaleTimeString()
    setEvents((prev) => [
      { type: messageType, data: payload, timestamp },
      ...prev.slice(0, 49), // Keep last 50 events
    ])
  }, [])

  // Subscribe directly to serverConnection for event logging
  useEffect(() => {
    const callbacks = new Map<MessageType, (data: unknown) => void>()

    IRONMON_TYPES.forEach((messageType) => {
      const callback = (data: unknown) => handleMessage(messageType, data)
      callbacks.set(messageType, callback)
      serverConnection.subscribe(messageType, callback as any)
    })

    return () => {
      callbacks.forEach((callback, messageType) => {
        serverConnection.unsubscribe(messageType, callback as any)
      })
    }
  }, [handleMessage])

  return (
    <div className="min-h-screen bg-black p-8 font-mono text-sm text-green-500">
      <h1 className="mb-4 border-b-2 border-green-500 pb-2 text-2xl">IronMON Events Debug</h1>

      <div className="mb-4">
        <span
          className={`rounded px-3 py-1 ${isConnected ? 'bg-green-600' : 'bg-red-600'} text-white`}>
          {isConnected ? '✓ Connected' : '✗ Disconnected'}
        </span>
      </div>

      {/* Stats from Questlog */}
      <div className="mb-6 rounded border border-gray-700 bg-gray-900 p-4">
        <h2 className="mb-3 text-lg text-cyan-400">Stats (Questlog)</h2>
        {statsLoading ? (
          <p className="text-gray-500">Loading stats...</p>
        ) : stats ? (
          <div>
            <div className="mb-4 grid grid-cols-4 gap-4">
              <div>
                <span className="text-gray-500">Challenge</span>
                <p className="text-white">{stats.challenge}</p>
              </div>
              <div>
                <span className="text-gray-500">Total Runs</span>
                <p className="text-white">{stats.total_runs}</p>
              </div>
              <div>
                <span className="text-gray-500">Victories</span>
                <p className="text-white">{stats.victories}</p>
              </div>
              <div>
                <span className="text-gray-500">Runs w/ Checkpoints</span>
                <p className="text-white">{stats.runs_with_results}</p>
              </div>
            </div>
            {stats.checkpoints.length > 0 && (
              <details>
                <summary className="cursor-pointer text-yellow-400 hover:underline">
                  Checkpoint Clear Rates
                </summary>
                <table className="mt-2 w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="pr-4">#</th>
                      <th className="pr-4">Checkpoint</th>
                      <th className="pr-4">Trainer</th>
                      <th className="pr-4">Entered</th>
                      <th className="pr-4">Survived</th>
                      <th>Survival Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.checkpoints.map((cp) => (
                      <tr key={cp.order} className="text-gray-300">
                        <td className="pr-4">{cp.order}</td>
                        <td className="pr-4">{cp.name}</td>
                        <td className="pr-4">{cp.trainer}</td>
                        <td className="pr-4">{cp.entered}</td>
                        <td className="pr-4">{cp.survived}</td>
                        <td>{(cp.survival_rate * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </div>
        ) : (
          <p className="text-red-400">Failed to load stats</p>
        )}
      </div>

      {/* Recent Runs from Questlog */}
      <div className="mb-6 rounded border border-gray-700 bg-gray-900 p-4">
        <h2 className="mb-3 text-lg text-cyan-400">Recent Runs (Questlog)</h2>
        {runsLoading ? (
          <p className="text-gray-500">Loading runs...</p>
        ) : runs ? (
          <div>
            <p className="mb-2 text-gray-500">{runs.count} total runs</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="pr-4">Seed</th>
                  <th className="pr-4">Highest Checkpoint</th>
                  <th className="pr-4">Victory</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.items.map((run) => (
                  <tr key={run.seed_number} className="text-gray-300">
                    <td className="pr-4">{run.seed_number}</td>
                    <td className="pr-4">{run.highest_checkpoint || '-'}</td>
                    <td className="pr-4">{run.is_victory ? '✓' : '-'}</td>
                    <td>{new Date(run.started_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-red-400">Failed to load runs</p>
        )}
      </div>

      {/* Live Event Log */}
      <h2 className="mb-3 text-lg text-cyan-400">Live Events (WebSocket)</h2>
      <div className="space-y-3">
        {events.length === 0 ? (
          <p className="text-gray-500">Waiting for IronMON events... Start a run in BizHawk!</p>
        ) : (
          events.map((event, i) => (
            <div
              key={i}
              className="rounded border border-l-4 border-gray-700 border-l-green-500 bg-gray-900 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-bold text-cyan-400">{event.type}</span>
                <span className="text-xs text-gray-500">{event.timestamp}</span>
              </div>
              <details>
                <summary className="cursor-pointer text-yellow-400 hover:underline">
                  Show data
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-black p-2 text-xs">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              </details>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
