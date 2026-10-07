import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef, useCallback } from 'react'

export const Route = createFileRoute('/debug/transcription')({
  component: TranscriptionDebug,
})

interface TranscriptionLine {
  text: string
  start: string
  end: string
  speaker?: number
}

interface TranscriptionUpdate {
  lines?: TranscriptionLine[]
  buffer_transcription?: string
  status?: string
  type?: string
}

const WS_URL = 'ws://zelan:8765/debug'

function TranscriptionDebug() {
  const [isConnected, setIsConnected] = useState(false)
  const [lines, setLines] = useState<TranscriptionLine[]>([])
  const [buffer, setBuffer] = useState('')
  const [updateCount, setUpdateCount] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      setIsConnected(true)
    }

    ws.onclose = () => {
      setIsConnected(false)
      setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }

    ws.onmessage = (event) => {
      try {
        const data: TranscriptionUpdate = JSON.parse(event.data)
        setUpdateCount((c) => c + 1)

        if (data.lines && data.lines.length > 0) {
          setLines(data.lines)
        }

        if (data.buffer_transcription !== undefined) {
          setBuffer(data.buffer_transcription)
        }
      } catch {
        // ignore parse errors
      }
    }

    wsRef.current = ws
  }, [])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [connect])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines, buffer])

  const fullText = lines.map((l) => l.text).join(' ')

  return (
    <div className="min-h-screen bg-black p-8 font-mono text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl">Transcription Debug</h1>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">{updateCount} updates</span>
            <span
              className={`rounded px-2 py-1 text-xs ${isConnected ? 'bg-green-800 text-green-200' : 'bg-red-800 text-red-200'}`}>
              {isConnected ? 'Connected' : 'Reconnecting...'}
            </span>
          </div>
        </div>

        {/* Live caption preview — what closed captions would look like */}
        <div className="mb-8">
          <h2 className="mb-2 text-sm tracking-wide text-gray-500 uppercase">Caption Preview</h2>
          <div className="flex min-h-[120px] items-end rounded-lg bg-gray-900 p-6">
            <p className="text-xl leading-relaxed">
              {buffer || fullText || <span className="text-gray-600">Waiting for speech...</span>}
            </p>
          </div>
        </div>

        {/* Committed lines */}
        <div className="mb-8">
          <h2 className="mb-2 text-sm tracking-wide text-gray-500 uppercase">
            Committed Lines ({lines.length})
          </h2>
          <div ref={scrollRef} className="max-h-96 overflow-y-auto rounded-lg bg-gray-900 p-4">
            {lines.length > 0 ? (
              <div className="space-y-1">
                {lines.map((line, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="w-24 shrink-0 text-right text-gray-600">{line.start}</span>
                    <span>{line.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No committed lines yet.</p>
            )}
          </div>
        </div>

        {/* Buffer (partial / in-progress) */}
        {buffer && (
          <div>
            <h2 className="mb-2 text-sm tracking-wide text-gray-500 uppercase">
              Buffer (in progress)
            </h2>
            <div className="rounded-lg bg-gray-900 p-4">
              <p className="text-yellow-400">{buffer}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
