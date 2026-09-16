import { useCallback } from 'react'

import { useAlertSound } from '@/hooks/use-alert-sound'
import { useRealtimeStore } from '@/store/realtime'
import type { AlertData } from '@/types/server'

// Real audio driving alert-lifecycle's holding phase. Starts playing the
// instant an instance mounts, regardless of its current phase — the
// machine's own audioEndedEarly guard already handles a short sting
// finishing before entering/revealing do, so this component doesn't need
// to know or care what phase it's in, only report when audio is done.
//
// soundEnabled mirrors the old useAlertQueue({ soundEnabled }) split
// (that hook is retired): every OBS browser source runs its own
// independent copy of this app, and
// only the dedicated audio-only source (routes/audio.tsx) actually plays
// sound — everything else would double (or N-tuple) it up if it played
// too. When disabled, useAlertSound's own fallback-timer hold still fires
// onComplete after alert.duration || its fallback, so a silent scene still
// holds the card for a sensible duration without needing its own timer.
function AlertAudioInstance({
  id,
  alert,
  soundEnabled,
}: {
  id: string
  alert: AlertData
  soundEnabled: boolean
}) {
  const handleComplete = useCallback(() => {
    useRealtimeStore.getState().dispatchAlertStack({ type: 'stack:lifecycle', id, event: 'audio:ended' })
  }, [id])

  useAlertSound(alert, { enabled: soundEnabled, onComplete: handleComplete })

  return null
}

// One instance per active card — mirrors how alert-stack.ts itself scales
// to N concurrent cards, each with independent audio.
export function AlertAudioDriver({ soundEnabled = true }: { soundEnabled?: boolean }) {
  const active = useRealtimeStore((s) => s.alertStack.active)

  return (
    <>
      {active.map((instance) => (
        <AlertAudioInstance key={instance.id} id={instance.id} alert={instance.alert} soundEnabled={soundEnabled} />
      ))}
    </>
  )
}
