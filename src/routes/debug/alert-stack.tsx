import { createFileRoute } from '@tanstack/react-router'
import { useRealtimeStore } from '@/store/realtime'
import type { AlertData } from '@/types/server'

export const Route = createFileRoute('/debug/alert-stack')({
  component: DebugAlertStack,
})

function simulateArrival(): void {
  const id = `debug-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const alert: AlertData = {
    id,
    type: 'twitch.channel.follow',
    message: 'simulated arrival',
    user_name: `test_user_${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
  }
  useRealtimeStore.getState().dispatchAlertStack({ type: 'stack:arrive', id, alert })
}

function DebugAlertStack() {
  const isConnected = useRealtimeStore((s) => s.isConnected)
  const alertStack = useRealtimeStore((s) => s.alertStack)

  return (
    <div className="min-h-screen bg-black text-white p-8 font-mono text-xs">
      <h1 className="text-2xl mb-4">Alert Stack Debug</h1>

      <div className="mb-4 flex items-center gap-4">
        <span className={`px-2 py-1 rounded ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
        <span className="px-2 py-1 rounded bg-gray-700">
          capacity: {alertStack.maxConcurrent} (VITE_ALERT_STACK_MAX)
        </span>
        <button
          type="button"
          onClick={simulateArrival}
          className="px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 cursor-pointer"
        >
          simulate arrival
        </button>
      </div>

      <div className="mb-8">
        <h2 className="text-xl mb-2">Active ({alertStack.active.length} / {alertStack.maxConcurrent})</h2>
        {alertStack.active.length > 0 ? (
          <ul className="list-disc list-inside">
            {alertStack.active.map((instance) => (
              <li key={instance.id}>
                {instance.id} — phase: <span className="text-yellow-400">{instance.lifecycle.phase}</span>
                {instance.lifecycle.audioEndedEarly && (
                  <span className="text-orange-400"> (audio ended early, pending)</span>
                )}
                {' — '}
                {instance.alert.type}
                {instance.alert.user_name ? ` — ${instance.alert.user_name}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">no active cards</p>
        )}
      </div>

      <div className="mb-8">
        <h2 className="text-xl mb-2">Backlog ({alertStack.backlog.length})</h2>
        {alertStack.backlog.length > 0 ? (
          <ol className="list-decimal list-inside">
            {alertStack.backlog.map((item) => (
              <li key={item.id}>
                {item.id} — {item.alert.type}
                {item.alert.user_name ? ` — ${item.alert.user_name}` : ''}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-gray-500">empty</p>
        )}
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer hover:underline">Raw JSON Data (click to expand)</summary>
        <pre className="mt-2 p-4 bg-gray-900 rounded overflow-auto max-h-96">
          {JSON.stringify(alertStack, null, 2)}
        </pre>
      </details>
    </div>
  )
}
