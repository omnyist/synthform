import { useMicStatus } from '@/hooks/use-synthmix'
import { cn } from '@/lib/utils'

// 'unknown' gets its own shape rather than sharing the MUTED pill's opacity
// fade: a dot borrowed from Status's presence-indicator language says "not
// confirmed yet", where fading the alarm-shaped pill in and out would read
// as "muted" for half the transition.
export const MicStatusBadge = () => {
  const { mute } = useMicStatus()

  if (mute === 'unknown') {
    return (
      <div className="outline-shark-920 bg-marigold size-4 animate-pulse rounded-full bg-radial-[at_50%_25%] outline-4" />
    )
  }

  return (
    <div
      className={cn(
        { 'opacity-100': mute === 'muted', 'opacity-0': mute === 'unmuted' },
        'font-caps ring-shark-960 rounded-md bg-gradient-to-b from-rose-500 to-rose-700 px-2 ring-4 inset-ring-1 inset-ring-rose-400 transition-opacity duration-300 ease-in-out text-shadow-none',
      )}>
      MUTED
    </div>
  )
}
