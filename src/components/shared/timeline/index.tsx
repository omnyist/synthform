import { useRef, useEffect } from 'react'

import { getEventComponent } from '@/components/shared/timeline/events'
import { Frame, Item } from '@/components/ui/chyron'
import { Chevron } from '@/components/ui/icons'
import { useTimeline } from '@/hooks/use-timeline'
import { usePipelineTest } from '@/hooks/use-pipeline-test'
import { EASE_POWER2_IN, EASE_POWER2_OUT, EASE_POWER3_OUT } from '@/lib/animations'
import { cn } from '@/lib/utils'
import type { TimelineEvent } from '@/types/events'
import {
  TIMELINE_AUTO_HIDE_DELAY,
  TIMELINE_MAX_EVENTS,
  TIMELINE_SHOW_DURATION,
  TIMELINE_HIDE_DURATION,
  TIMELINE_ITEM_FADE_DURATION,
  TIMELINE_ITEM_CASCADE_DELAY,
  TIMELINE_NEW_ITEM_DURATION,
  TIMELINE_SLIDE_DURATION,
  TIMELINE_HIDDEN_Y,
  TIMELINE_ITEM_INITIAL_Y,
} from '@/config/timeline'

import { ChatNotification, Cheer, Follow } from './item'

export const Timeline = () => {
  const { events: timelineEvents, lastPushTime } = useTimeline(TIMELINE_MAX_EVENTS)

  // Enable pipeline testing with keypress (dev only)
  usePipelineTest()

  const eventRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const animatedEvents = useRef<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const isVisible = useRef(false)


  // Show/hide timeline based on lastPushTime
  useEffect(() => {
    if (!containerRef.current) return
    const animations: Animation[] = []

    if (lastPushTime > 0 && timelineEvents.length > 0) {
      // Show timeline
      if (!isVisible.current) {
        isVisible.current = true

        // First, hide all current items to prevent flash. No Animation
        // object holds this yet, so it has to be an imperative set, same
        // as gsap.set was under the hood.
        const items = Array.from(eventRefs.current.values())
        items.forEach((item) => {
          item.style.opacity = '0'
          item.style.transform = `translateY(${TIMELINE_ITEM_INITIAL_Y}px)`
        })

        // Animate container appearing
        const showAnimation = containerRef.current.animate(
          [{ transform: `translateY(${TIMELINE_HIDDEN_Y}px)` }, { transform: 'translateY(0)' }],
          { duration: TIMELINE_SHOW_DURATION * 1000, easing: EASE_POWER3_OUT, fill: 'forwards' },
        )
        animations.push(showAnimation)

        showAnimation.finished
          .then(() => {
            // After container is visible, cascade in existing items
            items.forEach((item, index) => {
              animations.push(
                item.animate(
                  [
                    { opacity: 0, transform: `translateY(${TIMELINE_ITEM_INITIAL_Y}px)` },
                    { opacity: 1, transform: 'translateY(0)' },
                  ],
                  {
                    duration: TIMELINE_ITEM_FADE_DURATION * 1000,
                    delay: index * TIMELINE_ITEM_CASCADE_DELAY * 1000,
                    easing: EASE_POWER2_OUT,
                    fill: 'both',
                  },
                ),
              )
            })
          })
          .catch(() => {})
      }

      // Reset hide timer
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
      hideTimeoutRef.current = setTimeout(() => {
        isVisible.current = false
        if (containerRef.current) {
          const hideAnimation = containerRef.current.animate(
            [{ transform: 'translateY(0)' }, { transform: `translateY(${TIMELINE_HIDDEN_Y}px)` }],
            { duration: TIMELINE_HIDE_DURATION * 1000, easing: EASE_POWER2_IN, fill: 'forwards' },
          )
          hideAnimation.finished
            .then(() => {
              // Clear animated events when timeline is fully hidden
              // So next time it shows, all items cascade in together
              animatedEvents.current.clear()
            })
            .catch(() => {})
        }
      }, TIMELINE_AUTO_HIDE_DELAY)
    }

    return () => {
      animations.forEach((animation) => animation.cancel())
    }
  }, [lastPushTime, timelineEvents.length])

  useEffect(() => {
    // Only handle new items when timeline is already visible
    if (!isVisible.current) return

    const newElements: { element: HTMLElement; event: TimelineEvent }[] = []
    const existingElements: HTMLElement[] = []

    timelineEvents.forEach((event) => {
      const element = eventRefs.current.get(event.id)
      if (element) {
        if (!animatedEvents.current.has(event.id)) {
          newElements.push({ element, event })
          animatedEvents.current.add(event.id)
        } else {
          // Reset any previous transforms on existing elements
          element.style.transform = 'translateX(0)'
          existingElements.push(element!)
        }
      }
    })

    const animations: Animation[] = []

    if (newElements.length > 0) {
      // For the slide effect, we need to handle flex reflow
      newElements.forEach(({ element }, index) => {
        // Hide new element initially (no reflow yet)
        element.style.display = 'none'

        // Capture current positions of existing elements
        const oldPositions = existingElements.map((el) => el.getBoundingClientRect().left)

        // Show new element (causes reflow); fill: 'both' on its own
        // animate() call below holds it invisible until that starts.
        element.style.display = 'block'

        // Capture new positions after reflow
        const newPositions = existingElements.map((el) => el.getBoundingClientRect().left)

        // Calculate how much each element moved due to reflow
        existingElements.forEach((el, i) => {
          const oldPos = oldPositions[i]
          const newPos = newPositions[i]
          if (oldPos === undefined || newPos === undefined) return

          const shift = newPos - oldPos
          if (shift !== 0) {
            // Animate from the old (pre-reflow) position back to identity
            animations.push(
              el.animate(
                [{ transform: `translateX(${-shift}px)` }, { transform: 'translateX(0)' }],
                { duration: TIMELINE_SLIDE_DURATION * 1000, easing: EASE_POWER3_OUT, fill: 'forwards' },
              ),
            )
          }
        })

        // Animate new element appearing
        animations.push(
          element.animate(
            [
              { opacity: 0, transform: `translateY(${TIMELINE_HIDDEN_Y}px)` },
              { opacity: 1, transform: 'translateY(0)' },
            ],
            {
              duration: TIMELINE_NEW_ITEM_DURATION * 1000,
              delay: index * TIMELINE_ITEM_CASCADE_DELAY * 1000,
              easing: EASE_POWER3_OUT,
              fill: 'both',
            },
          ),
        )
      })
    }

    const currentEventIds = new Set(timelineEvents.map((e) => e.id))
    animatedEvents.current.forEach((id) => {
      if (!currentEventIds.has(id)) {
        animatedEvents.current.delete(id)
        eventRefs.current.delete(id)
      }
    })

    return () => {
      animations.forEach((animation) => animation.cancel())
    }
  }, [timelineEvents])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [])

  return (
    <Frame ref={containerRef} style={{ transform: `translateY(${TIMELINE_HIDDEN_Y}px)` }}>
      <div className="flex h-full items-center gap-8 p-6">
        <div className="from-shark-840 to-shark-880 inset-ring-shark-800 flex size-8 items-center justify-center rounded-sm bg-gradient-to-b inset-ring-1">
          <Chevron />
        </div>

        {timelineEvents.map((event, i) => {
          const component = getEventComponent(event, {
            ChatNotification,
            Cheer,
            Follow,
          })
          if (!component) return null

          return (
            <Item
              key={event.id}
              ref={(el) => {
                if (el) {
                  eventRefs.current.set(event.id, el)
                } else {
                  // Clean up ref when component unmounts
                  eventRefs.current.delete(event.id)
                }
              }}
              className={cn('', { '-ml-4': i === 0 })}>
              {component}
            </Item>
          )
        })}
      </div>
    </Frame>
  )
}
