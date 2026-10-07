import type { Meta, StoryObj } from '@storybook/react-vite'

import { useRealtimeStore } from '@/store/realtime'
import type { LimitBreakData } from '@/types/server'

import { LimitBreak } from './limitbreak'

// Seeds the gauge's data only. The maxed and executing phases play sounds, and executing resets
// itself when its sound ends, so the bars' fill comes from the data, as it does between phases.
const seed =
  (limitbreak: LimitBreakData | null, isConnected = true) =>
  () => {
    useRealtimeStore.setState({ limitbreak, isConnected })
  }

const meta = {
  title: 'Omnibar/LimitBreak',
  component: LimitBreak,
  parameters: {
    // Each story seeds the one realtime store, so the docs page renders each in its own frame.
    docs: { story: { inline: false, iframeHeight: '96px' } },
  },
} satisfies Meta<typeof LimitBreak>

export default meta
type Story = StoryObj<typeof meta>

// The waiting and disconnected lines set no colour of their own, so they're black (1.06:1 on
// shark-960). The /limitbreak browser source draws them over whatever OBS has beneath it, so there's
// no background in the component to measure them against; the exception covers only this rule on
// these two stories.
const unstyledText = { a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } } }

export const Waiting: Story = { beforeEach: seed(null), parameters: unstyledText }

export const Disconnected: Story = { beforeEach: seed(null, false), parameters: unstyledText }

export const Charging: Story = {
  beforeEach: seed({ count: 2, bar1: 0.65, bar2: 0, bar3: 0, isMaxed: false }),
}

export const TwoBarsFull: Story = {
  beforeEach: seed({ count: 7, bar1: 1, bar2: 1, bar3: 0.35, isMaxed: false }),
}

export const Maxed: Story = {
  beforeEach: seed({ count: 12, bar1: 1, bar2: 1, bar3: 1, isMaxed: true }),
}
