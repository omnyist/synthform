import { useEffect } from 'react'
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
//
// No fired-ref guards here — `volume` is a static literal at every call
// site, so [phase, volume] already gates each effect to run exactly once
// per phase entry. A ref guard was tried here once and broke under
// StrictMode's dev-only mount->cleanup->remount: the guard survived the
// simulated unmount (nothing reset it), so the remount's early return
// left the first mount's Audio object playing with its 'ended' listener
// and fallback timer already torn down — permanently stuck at
// 'executing' until reload.
export function useLimitBreakAudio(volume = 0.2) {
  const phase = useRealtimeStore((s) => s.limitBreak.phase)
  const dispatchLimitBreak = useRealtimeStore((s) => s.dispatchLimitBreak)

  useEffect(() => {
    if (phase !== 'maxed') return

    const audio = new Audio(MAXED_SOUND)
    audio.volume = volume
    audio.play().catch((error) => {
      console.warn('Could not play limit break sound:', error)
    })

    return () => {
      audio.pause()
    }
  }, [phase, volume])

  useEffect(() => {
    if (phase !== 'executing') return

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
      audio.pause()
    }
  }, [phase, volume, dispatchLimitBreak])
}
