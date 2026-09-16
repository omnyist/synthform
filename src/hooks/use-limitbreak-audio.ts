import { useEffect, useRef } from 'react'
import { useRealtimeStore } from '@/store/realtime'

const MAXED_SOUND = '/sounds/limit-break.ogg'
// Plays on limitbreak:executed. bonk (omnypro/bonk) fires its volley on
// the same event after a delay in its triggers.cfg that is tuned to this
// file's length (3.82 s as of 2026-09-12). Nothing links the two: swap or
// re-cut this file and bonk's delay needs updating too.
const EXECUTED_SOUND = '/sounds/limit-break-executed.ogg'
// This is only a safety net for if 'ended' never fires (same role as
// useAlertSound's fallbackDuration) — the real file is 3.82s.
const EXECUTED_FALLBACK_MS = 5000

// Plays the two limit-break sounds off the machine's phase transitions,
// shared by every scene instead of each duplicating its own
// hasJustMaxed/hasJustExecuted effect. Entering 'maxed' fires once,
// fire-and-forget. Entering 'executing' is the one that matters: it
// drives the machine's own exit back to 'charging' via audio:ended —
// same pattern as alert-lifecycle's holding phase, not a re-guessed
// timer duration.
export function useLimitBreakAudio(volume = 0.2) {
  const phase = useRealtimeStore((s) => s.limitBreakPhase)
  const dispatchLimitBreak = useRealtimeStore((s) => s.dispatchLimitBreak)

  const firedMaxedRef = useRef(false)
  const firedExecutingRef = useRef(false)

  useEffect(() => {
    if (phase !== 'maxed') {
      firedMaxedRef.current = false
      return
    }
    if (firedMaxedRef.current) return
    firedMaxedRef.current = true

    const audio = new Audio(MAXED_SOUND)
    audio.volume = volume
    audio.play().catch((error) => {
      console.warn('Could not play limit break sound:', error)
    })
  }, [phase, volume])

  useEffect(() => {
    if (phase !== 'executing') {
      firedExecutingRef.current = false
      return
    }
    if (firedExecutingRef.current) return
    firedExecutingRef.current = true

    const audio = new Audio(EXECUTED_SOUND)
    audio.volume = volume

    let completed = false
    const complete = () => {
      if (completed) return
      completed = true
      clearTimeout(fallbackTimer)
      dispatchLimitBreak('audio:ended')
    }

    const fallbackTimer = setTimeout(complete, EXECUTED_FALLBACK_MS)
    audio.addEventListener('ended', complete, { once: true })
    audio.play().catch((error) => {
      console.error('Could not play limit break execution sound:', error)
      complete()
    })

    return () => {
      clearTimeout(fallbackTimer)
      audio.removeEventListener('ended', complete)
    }
  }, [phase, volume, dispatchLimitBreak])
}
