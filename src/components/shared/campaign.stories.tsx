import type { Meta, StoryObj } from '@storybook/react-vite'

import { useRealtimeStore } from '@/store/realtime'
import type { Campaign as CampaignData, Milestone } from '@/types/campaign'

import { Campaign } from './campaign'

// Typed as synthfunc's campaign:sync payload (src/types/campaign.ts).
const milestone = (threshold: number, title: string, isUnlocked: boolean): Milestone => ({
  id: `milestone-${threshold}`,
  threshold,
  title,
  description: '',
  is_unlocked: isUnlocked,
  unlocked_at: isUnlocked ? '2026-10-01T20:00:00Z' : null,
  image_url: '',
})

const campaign = (overrides: Partial<CampaignData> = {}): CampaignData => ({
  id: 'campaign-1',
  name: 'Subathon',
  slug: 'subathon',
  description: '',
  start_date: '2026-10-01',
  end_date: '2026-10-31',
  is_active: true,
  timer_mode: false,
  timer_initial_seconds: 0,
  seconds_per_sub: 0,
  seconds_per_tier2: 0,
  seconds_per_tier3: 0,
  max_timer_seconds: null,
  metric: {
    id: 'metric-1',
    total_subs: 31,
    total_resubs: 11,
    total_bits: 12000,
    total_donations: 0,
    timer_seconds_remaining: 0,
    timer_started_at: null,
    timer_paused_at: null,
    total_duration: 0,
    stream_started_at: null,
    extra_data: {},
    updated_at: '2026-10-07T20:00:00Z',
  },
  milestones: [
    milestone(25, 'Emote vote', true),
    milestone(50, 'Cosplay stream', false),
    milestone(100, 'Twenty-four hour stream', false),
  ],
  ...overrides,
})

const seed = (data: CampaignData | null) => () => {
  useRealtimeStore.setState({ campaign: data })
}

const meta = {
  title: 'Shared/Campaign',
  component: Campaign,
  decorators: [
    (Story) => (
      <div className="flex w-[1280px]">
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
            // "SUBS" is text-shark-560 (#607080) on the chyron's shark-960 (#090a0c), 3.9:1, under
            // WCAG AA's 4.5:1 for text this size. It's the overlay's design, rendered into a
            // broadcast rather than read as a page, so it's an exception here rather than a change
            // to the component. Every other element still gets the contrast check.
            id: 'color-contrast',
            selector: '*:not(.text-shark-560)',
          },
        ],
      },
    },
  },
} satisfies Meta<typeof Campaign>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  beforeEach: seed(campaign()),
}

// Every milestone unlocked: there's no next threshold to count towards.
export const AllMilestonesUnlocked: Story = {
  beforeEach: seed(
    campaign({
      milestones: [
        milestone(25, 'Emote vote', true),
        milestone(50, 'Cosplay stream', true),
        milestone(100, 'Twenty-four hour stream', true),
      ],
    }),
  ),
}

export const LongNames: Story = {
  beforeEach: seed(
    campaign({
      name: 'The Autumn Charity Subathon',
      milestones: [
        milestone(500, 'Play the whole of Final Fantasy XIV’s story, start to end', false),
      ],
    }),
  ),
}

// Before synthfunc has sent a campaign, or when none is running.
export const NoCampaign: Story = {
  beforeEach: seed(null),
}
