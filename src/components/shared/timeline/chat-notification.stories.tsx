import type { Meta, StoryObj } from '@storybook/react-vite'

import { Frame, Item } from '@/components/ui/chyron'

import * as fixtures from './fixtures'
import { ChatNotification } from './item'

const meta = {
  title: 'Timeline/ChatNotification',
  component: ChatNotification,
  // Inside the chyron, the way the timeline renders it.
  decorators: [
    (Story) => (
      <Frame>
        <div className="flex h-full items-center gap-8 p-6">
          <Item>
            <Story />
          </Item>
        </div>
      </Frame>
    ),
  ],
  parameters: {
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
        ],
      },
    },
  },
  args: { event: fixtures.sub },
} satisfies Meta<typeof ChatNotification>

export default meta
type Story = StoryObj<typeof meta>

export const Sub: Story = {}

export const Resub: Story = { args: { event: fixtures.resub } }

export const ResubWithoutMonths: Story = { args: { event: fixtures.resubWithoutMonths } }

export const SubGift: Story = { args: { event: fixtures.subGift } }

export const CommunitySubGift: Story = { args: { event: fixtures.communitySubGift } }

export const Raid: Story = { args: { event: fixtures.raid } }

export const BitsBadgeTier: Story = { args: { event: fixtures.bitsBadgeTier } }

export const CharityDonation: Story = { args: { event: fixtures.charityDonation } }

export const UnknownNoticeType: Story = { args: { event: fixtures.unknownNotice } }

export const LongName: Story = { args: { event: fixtures.longName } }
