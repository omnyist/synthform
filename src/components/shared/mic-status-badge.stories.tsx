import type { Meta, StoryObj } from '@storybook/react-vite'

import type { MicStatusState } from '@/machines/mic-status'
import { useRealtimeStore } from '@/store/realtime'

import { MicStatusBadge } from './mic-status-badge'

const seed = (synthmix: MicStatusState) => () => {
  useRealtimeStore.setState({ synthmix })
}

const meta = {
  title: 'Shared/MicStatusBadge',
  component: MicStatusBadge,
  parameters: {
    // Each story seeds the one realtime store, so the docs page renders each in its own frame.
    docs: { story: { inline: false, iframeHeight: '96px' } },
  },
} satisfies Meta<typeof MicStatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Unknown: Story = {
  beforeEach: seed({ connection: 'connecting', mute: 'unknown' }),
}

export const Muted: Story = {
  beforeEach: seed({ connection: 'connected', mute: 'muted' }),
}

export const Unmuted: Story = {
  beforeEach: seed({ connection: 'connected', mute: 'unmuted' }),
}
