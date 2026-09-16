import type { FC, PropsWithChildren } from 'react'

import { useLimitbreak } from '@/hooks/use-limitbreak'
import { useLimitBreakAudio } from '@/hooks/use-limitbreak-audio'

const Bar: FC<PropsWithChildren> = ({ children }) => {
  return <div className="relative h-3 w-16 overflow-hidden rounded-xs bg-[#1E3246]">{children}</div>
}

const Progress: FC<{ bar: number; isFilled: boolean }> = ({ bar, isFilled }) => {
  return (
    <div
      style={{
        width: `${bar * 100}%`,
        height: '100%',
        backgroundColor: isFilled ? '#ffff08' : '#0096ff',
        transition: 'width 0.3s ease',
      }}
    />
  )
}

export const LimitBreak = () => {
  const { data, count, filledBars, isConnected } = useLimitbreak()
  useLimitBreakAudio(0.1)

  if (!data) {
    return (
      <div>
        <div>Limit Break: {isConnected ? 'Waiting for data...' : 'Disconnected'}</div>
      </div>
    )
  }

  const { bar1, bar2, bar3 } = data

  return (
    <div>
      <div className="flex items-center justify-center gap-2">
        <Bar>
          <Progress bar={bar1} isFilled={filledBars.bar1} />
        </Bar>
        <Bar>
          <Progress bar={bar2} isFilled={filledBars.bar2} />
        </Bar>
        <Bar>
          <Progress bar={bar3} isFilled={filledBars.bar3} />
        </Bar>
        <div className="font-sans font-bold text-[#0096ff]">{count}</div>
      </div>
    </div>
  )
}
