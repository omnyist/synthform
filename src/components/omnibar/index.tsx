import { useRef } from 'react'

import { AlertAudioDriver } from '@/components/shared/alert-audio-driver'
import { Campaign } from '@/components/shared/campaign'
import { MicStatusBadge } from '@/components/shared/mic-status-badge'
import { Timeline } from '@/components/shared/timeline'
import { Canvas } from '@/components/ui/canvas'
import { useCampaign } from '@/hooks/use-campaign'
import { EASE_POWER3_IN, EASE_POWER3_OUT } from '@/lib/animations'

const BAR_HEIGHT = 64
const ANIMATION_DURATION = 0.4

export const Omnibar = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isActive: isCampaignActive } = useCampaign()

  // A plain CSS transition on transform gets the same "no animation on
  // first paint, animate on later changes" behavior gsap.set/gsap.to were
  // hand-coding around hasInitialized — the browser paints the initial
  // value directly on mount, with nothing to transition from.
  const targetY = isCampaignActive ? 0 : BAR_HEIGHT

  return (
    <Canvas>
      {/* Invisible alert sound handler — soundEnabled: false, routes/audio.tsx is the dedicated audio source */}
      <AlertAudioDriver soundEnabled={false} />

      <div ref={containerRef} className="h-canvas grid grid-rows-[1fr_64px]">
        <div className="h-full"></div>
        <div
          className="relative flex items-center"
          style={{
            transform: `translateY(${targetY}px)`,
            transition: `transform ${ANIMATION_DURATION}s ${isCampaignActive ? EASE_POWER3_OUT : EASE_POWER3_IN}`,
          }}>
          {/* Base layer: Campaign */}
          <div className="relative z-10 flex w-full items-center">
            <Campaign />

            <div className="text-shark-240 bg-shark-960 flex h-16 items-center px-6 font-sans text-lg text-shadow-sm/50">
              <MicStatusBadge />
            </div>
          </div>

          {/* Timeline layer: Overlays on top */}
          <div className="absolute inset-0 z-20 flex items-center">
            <Timeline />
          </div>

          {/* Decorative borders */}
          <div className="absolute top-0 z-50 h-1 w-full bg-[#040506]"></div>
          <div className="from-marigold to-lime absolute bottom-0 z-50 h-[1px] w-full bg-gradient-to-r"></div>
        </div>
      </div>
    </Canvas>
  )
}
