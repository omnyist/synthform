import { createFileRoute } from '@tanstack/react-router'
import { useRealtimeStore } from '@/store/realtime'

export const Route = createFileRoute('/debug/events')({
  component: DebugTimeline,
})

function DebugTimeline() {
  const events = useRealtimeStore((s) => s.timeline.events)
  const isConnected = useRealtimeStore((s) => s.isConnected)

  return (
    <div className="min-h-screen bg-black p-8 font-mono text-xs text-white">
      <h1 className="mb-4 text-2xl">Timeline Debug</h1>

      <div className="mb-4">
        <span className={`rounded px-2 py-1 ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="mb-8">
        <h2 className="mb-2 text-xl">Timeline Events</h2>
        {events.length > 0 ? (
          <div>
            <p className="mb-2">{events.length} events</p>

            <div className="mb-4">
              <h3 className="mb-2 text-lg">Event Types:</h3>
              <ul className="list-inside list-disc">
                {events.map((event, i) => (
                  <li key={i}>
                    {event.type} - ID: {event.id} - User: {event.data?.user_name || 'Unknown'}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-4">
              <h3 className="mb-2 text-lg">Events with channel.chat.notification:</h3>
              <ul className="list-inside list-disc">
                {events
                  .filter((event) => event.type?.includes('channel.chat.notification'))
                  .map((event, i) => (
                    <li key={i}>
                      {event.type} - notice_type:{' '}
                      {(event.data?.payload as { notice_type?: string } | undefined)?.notice_type ||
                        'N/A'}
                    </li>
                  ))}
              </ul>
              {events.filter((event) => event.type?.includes('channel.chat.notification'))
                .length === 0 && (
                <p className="text-red-500">No channel.chat.notification events found!</p>
              )}
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer hover:underline">
                Raw JSON Data (click to expand)
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded bg-gray-900 p-4">
                {JSON.stringify(events, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <p>Waiting for timeline events...</p>
        )}
      </div>
    </div>
  )
}
