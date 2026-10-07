import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'

import { useRealtimeStore } from '@/store/realtime'
import type { LimitBreakData } from '@/types/server'

import { LimitBreak } from './limitbreak'

// Seeds the gauge's data only. The maxed and executing phases play sounds, and executing resets
// itself when its sound ends, so the bars' fill comes from the data, as it does between phases.
const seed = (limitbreak: LimitBreakData | null) => () => {
  useRealtimeStore.setState({ limitbreak, isConnected: true })
}

const meta = {
  title: 'Coworking/LimitBreak',
  component: LimitBreak,
  parameters: {
    // Each story seeds the one realtime store, so the docs page renders each in its own frame.
    docs: { story: { inline: false, iframeHeight: '96px' } },
  },
  // The gauge fades in over 600ms when its data arrives. The accessibility check runs after play,
  // so play waits for the fade; during it the count is transparent and the check passes over it.
  // The fade starts in an effect after mount and may not exist yet, so wait out its length first.
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 600))
    await waitFor(() => expect(canvasElement.getAnimations({ subtree: true })).toHaveLength(0))
  },
} satisfies Meta<typeof LimitBreak>

export default meta
type Story = StoryObj<typeof meta>

// No data yet: the scene keeps the space and draws nothing.
export const NoData: Story = { beforeEach: seed(null) }

export const Empty: Story = {
  beforeEach: seed({ count: 0, bar1: 0, bar2: 0, bar3: 0, isMaxed: false }),
}

export const Charging: Story = {
  beforeEach: seed({ count: 2, bar1: 0.65, bar2: 0, bar3: 0, isMaxed: false }),
}

export const TwoBarsFull: Story = {
  beforeEach: seed({ count: 7, bar1: 1, bar2: 1, bar3: 0.35, isMaxed: false }),
}

export const Maxed: Story = {
  beforeEach: seed({ count: 12, bar1: 1, bar2: 1, bar3: 1, isMaxed: true }),
}
