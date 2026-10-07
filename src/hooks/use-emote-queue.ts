import { useCallback, useEffect, useReducer, useRef } from 'react'

import { createEmoteQueue, emoteQueueReducer, type EmoteQueueEntry } from '@/machines/emote-queue'

// Drives emote-queue.ts's admission for EmoteRain. Chat (or the debug
// overlay) calls queueEmote() when an emote arrives; the physics sim calls
// reap() once a body actually leaves the simulation. onAdmit fires exactly
// once per entry the machine promotes into an active slot — the only place
// emote-rain.tsx should ever call spawnEmote() from, so a queued arrival
// spawns exactly once, whether it's admitted immediately or after a wait
// in the backlog.
export function useEmoteQueue(maxConcurrent: number, onAdmit: (entry: EmoteQueueEntry) => void) {
  const [state, dispatch] = useReducer(emoteQueueReducer, maxConcurrent, createEmoteQueue)
  const seenActiveIds = useRef<Set<string>>(new Set())
  const onAdmitRef = useRef(onAdmit)

  useEffect(() => {
    onAdmitRef.current = onAdmit
  }, [onAdmit])

  useEffect(() => {
    const currentIds = new Set(state.active.map((entry) => entry.id))

    state.active.forEach((entry) => {
      if (!seenActiveIds.current.has(entry.id)) {
        onAdmitRef.current(entry)
      }
    })

    seenActiveIds.current = currentIds
  }, [state.active])

  const queueEmote = useCallback((emoteId: string) => {
    const id = `${emoteId}-${Date.now()}-${Math.random()}`
    dispatch({ type: 'queue:arrive', id, emoteId })
    return id
  }, [])

  const reap = useCallback((id: string) => {
    dispatch({ type: 'queue:reap', id })
  }, [])

  return {
    active: state.active,
    backlog: state.backlog,
    maxConcurrent: state.maxConcurrent,
    queueEmote,
    reap,
  }
}
