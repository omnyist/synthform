import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'

import { useRealtimeStore } from '@/store/realtime'
import type { TimelineEvent } from '@/types/events'

import * as fixtures from './fixtures'
import { Timeline } from './index'

// The timeline shows when lastPushTime moves and hides itself 30 seconds later.
const seed = (events: TimelineEvent[]) => () => {
  useRealtimeStore.setState({
    timeline: {
      ...useRealtimeStore.getInitialState().timeline,
      events,
      latestEvent: events[0] ?? null,
      lastPushTime: events.length > 0 ? Date.now() : 0,
    },
  })
}

const meta = {
  title: 'Timeline/Timeline',
  component: Timeline,
  // The bottom row of the omnibar, which clips the timeline while it's hidden below it.
  decorators: [
    (Story) => (
      <div className="relative flex h-16 w-[1280px] items-center overflow-hidden">
        <Story />
      </div>
    ),
  ],
  parameters: {
    // Each story seeds the one realtime store, so the docs page renders each in its own frame.
    docs: { story: { inline: false, iframeHeight: '120px' } },
    a11y: {
      config: {
        rules: [
          {
            // The chyron's event label is text-shark-560 (#607080) on shark-960 (#090a0c), 3.9:1,
            // under WCAG AA's 4.5:1 for text this size. It's the overlay's design, rendered into a
            // broadcast rather than read as a page, so it's an exception here rather than a change
            // to the component. Every other element still gets the contrast check.
            id: 'color-contrast',
            selector: '*:not(.text-shark-560)',
          },
          {
            // The chyron Frame is overflow-x-hidden, which makes its vertical overflow auto, and the
            // 32px chevron overflows the 16px that p-6 leaves in the 64px bar, so axe sees a
            // scrollable region with nothing focusable in it. The overlay is an OBS browser source
            // that nobody scrolls or tabs through, so keyboard access to it doesn't apply.
            id: 'scrollable-region-focusable',
            enabled: false,
          },
        ],
      },
    },
  },
} satisfies Meta<typeof Timeline>

export default meta
type Story = StoryObj<typeof meta>

// The timeline slides up and then fades its items in, close to two seconds with twenty events. The
// accessibility check runs after play, so play waits for the shown state; before it, the items are
// clipped and transparent and the check passes over them.
const shown: Story['play'] = async ({ canvasElement }) => {
  await waitFor(
    async () => {
      const animations = canvasElement.getAnimations({ subtree: true })
      // The slide, then the items' fades, which start once the slide ends.
      await expect(animations.length).toBeGreaterThan(1)
      await expect(animations.every((animation) => animation.playState === 'finished')).toBe(true)
    },
    { timeout: 5000 },
  )
}

// Nothing to show, so the timeline stays below the bar.
export const Empty: Story = {
  beforeEach: seed([]),
}

export const OneEvent: Story = {
  beforeEach: seed([fixtures.follow('follow-mirai', 'Mirai')]),
  play: shown,
}

export const Mixed: Story = {
  beforeEach: seed([
    fixtures.raid,
    fixtures.cheer,
    fixtures.resub,
    fixtures.follow('follow-mirai', 'Mirai'),
    fixtures.communitySubGift,
  ]),
  play: shown,
}

// The overlay keeps up to twenty, more than the bar is wide; the rest run off the edge.
export const Full: Story = {
  beforeEach: seed([
    fixtures.longName,
    fixtures.raid,
    fixtures.bigCheer,
    fixtures.charityDonation,
    fixtures.subGift,
    fixtures.resub,
    fixtures.bitsBadgeTier,
    fixtures.anonymousCheer,
    fixtures.sub,
    ...Array.from({ length: 11 }, (_, i) => fixtures.follow(`follow-${i}`, `Follower${i + 1}`)),
  ]),
  play: shown,
}
