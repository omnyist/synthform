import type { Meta, StoryObj } from '@storybook/react-vite'

import type { MicStatusState } from '@/machines/mic-status'
import { useRealtimeStore } from '@/store/realtime'
import type { StreamStatus } from '@/types/server'

import { Status } from './status'

const seed =
  (
    status: StreamStatus | null,
    synthmix: MicStatusState = { connection: 'connected', mute: 'unmuted' },
  ) =>
  () => {
    useRealtimeStore.setState({ status, synthmix })
  }

const status = (value: StreamStatus['status'], message = ''): StreamStatus => ({
  status: value,
  message,
  updated_at: '2026-10-07T20:00:00Z',
})

const meta = {
  title: 'Coworking/Status',
  component: Status,
  // The width of the coworking scene's middle column.
  decorators: [
    (Story) => (
      <div className="w-[492px]">
        <Story />
      </div>
    ),
  ],
  parameters: {
    // Each story seeds the one realtime store, so the docs page renders each in its own frame.
    docs: { story: { inline: false, iframeHeight: '120px' } },
  },
} satisfies Meta<typeof Status>

export default meta
type Story = StoryObj<typeof meta>

export const Online: Story = { beforeEach: seed(status('online')) }

export const Away: Story = { beforeEach: seed(status('away')) }

export const Busy: Story = { beforeEach: seed(status('busy')) }

export const Brb: Story = { beforeEach: seed(status('brb')) }

export const Focus: Story = { beforeEach: seed(status('focus')) }

export const CustomMessage: Story = { beforeEach: seed(status('busy', 'in a meeting')) }

export const LongMessage: Story = {
  beforeEach: seed(status('focus', 'writing the Storybook convention for every synth frontend')),
}

export const Muted: Story = {
  beforeEach: seed(status('online'), { connection: 'connected', mute: 'muted' }),
}

// Before synthfunc has sent a status, and before synthmix has said whether the mic is muted.
export const NoStatusYet: Story = {
  beforeEach: seed(null, { connection: 'connecting', mute: 'unknown' }),
}
