import { useEffect, useRef, useCallback, forwardRef, type FC, type PropsWithChildren } from 'react'

import { useLimitbreak } from '@/hooks/use-limitbreak'
import { useLimitBreakAudio } from '@/hooks/use-limitbreak-audio'
import { animateLimitBreakExecute } from '@/lib/animations'
import { cn } from '@/lib/utils'

const Bar = forwardRef<HTMLDivElement, PropsWithChildren>(({ children }, ref) => {
  return (
    <div
      ref={ref}
      className="outline-shark-520 border-shark-920 bg-shark-840 relative h-3 w-20 overflow-hidden rounded-xs border-2 outline-2">
      {children}
    </div>
  )
})
Bar.displayName = 'Bar'

const Progress: FC<{ bar: number; isFilled: boolean }> = ({ bar, isFilled }) => {
  return (
    <div
      className={cn(
        'h-full bg-gradient-to-r',
        isFilled
          ? 'from-[#ff8416] via-[#ffff08] to-[#ff8416]'
          : 'from-[#0096ff] via-[#4adfff] to-[#ffffff]',
        'ease transition-all duration-300',
      )}
      style={{ width: `${bar * 100}%` }}
    />
  )
}

export const LimitBreak = () => {
  const { data, count, filledBars, phase } = useLimitbreak()
  useLimitBreakAudio(0.2)

  const containerRef = useRef<HTMLDivElement>(null)
  const barsRef = useRef<HTMLDivElement[]>([])
  const hasAnimatedEntrance = useRef(false)

  // Animate execution
  useEffect(() => {
    if (phase !== 'executing' || !containerRef.current) return
    const animation = animateLimitBreakExecute(containerRef.current)
    return () => animation.cancel()
  }, [phase])

  // Simple entrance animation when data loads
  useEffect(() => {
    if (!data || !containerRef.current || hasAnimatedEntrance.current) return
    const animation = containerRef.current.animate(
      [
        { transform: 'translateY(20px)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ],
      { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
    )
    hasAnimatedEntrance.current = true
    return () => animation.cancel()
  }, [data])

  // Create reusable ref setter
  const setBarRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      if (el) barsRef.current[index] = el
    },
    [],
  )

  if (!data) {
    return (
      <div data-limitbreak className="pr-[26px]">
        {/* <div>Limit Break: {isConnected ? 'Waiting for data...' : 'Disconnected'}</div> */}
      </div>
    )
  }

  const { bar1, bar2, bar3 } = data

  return (
    <div ref={containerRef} className="pr-[26px]" data-limitbreak>
      <div className="flex items-center justify-center gap-3">
        <div className="font-caps text-shark-120 flex items-center gap-1 text-2xl">{count}</div>
        <Bar ref={setBarRef(0)}>
          <Progress bar={bar1} isFilled={filledBars.bar1} />
        </Bar>
        <Bar ref={setBarRef(1)}>
          <Progress bar={bar2} isFilled={filledBars.bar2} />
        </Bar>
        <Bar ref={setBarRef(2)}>
          <Progress bar={bar3} isFilled={filledBars.bar3} />
        </Bar>
      </div>
    </div>
  )
}
