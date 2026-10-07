// Timeline events for the stories, typed as synthfunc sends them over the overlay socket
// (src/types/events.ts), so a change to those types breaks the stories at typecheck. Fixed ids and
// names rather than TestEventFactory's random ones, so a story renders the same every time.

import type {
  ChannelFollowEvent,
  ChatNotificationEvent,
  ChatNotificationPayload,
  CheerEvent,
  CheerPayload,
} from '@/types/events'

const TIMESTAMP = '2026-10-07T20:00:00Z'

const BROADCASTER = {
  broadcaster_user_id: '49823123',
  broadcaster_user_name: 'avalonstar',
  broadcaster_user_display_name: 'Avalonstar',
}

const user = (name: string) => ({
  id: `user-${name.toLowerCase()}`,
  name: name.toLowerCase(),
  display_name: name,
  login: name.toLowerCase(),
})

function chatNotification(
  id: string,
  chatter: string,
  notice: Pick<ChatNotificationPayload, 'notice_type'> & Partial<ChatNotificationPayload>,
): ChatNotificationEvent {
  return {
    id,
    type: 'twitch.channel.chat.notification',
    data: {
      timestamp: TIMESTAMP,
      user_name: chatter.toLowerCase(),
      payload: {
        broadcaster_user_id: BROADCASTER.broadcaster_user_id,
        broadcaster_user_name: BROADCASTER.broadcaster_user_name,
        chatter_user_id: `user-${chatter.toLowerCase()}`,
        chatter_user_name: chatter.toLowerCase(),
        chatter_display_name: chatter,
        chatter_is_anonymous: false,
        colour: '#9147FF',
        badges: [],
        system_message: '',
        message_id: `msg-${id}`,
        message: { text: '', fragments: [] },
        ...notice,
      },
    },
  }
}

export const sub = chatNotification('sub', 'Mirai', {
  notice_type: 'sub',
  sub: { tier: '1000', prime: false, months: 1 },
})

export const resub = chatNotification('resub', 'Kaedenn', {
  notice_type: 'resub',
  resub: {
    tier: '1000',
    prime: false,
    gift: false,
    months: 1,
    cumulative_months: 37,
    streak_months: 12,
  },
})

// Twitch can leave out the month count; the item shows a question mark.
export const resubWithoutMonths = chatNotification('resub-without-months', 'Kaedenn', {
  notice_type: 'resub',
})

export const subGift = chatNotification('sub-gift', 'Shiro', {
  notice_type: 'sub_gift',
  sub_gift: {
    tier: '1000',
    months: 1,
    cumulative_total: 4,
    community_gift_id: null,
    recipient: user('Lumina'),
  },
})

export const communitySubGift = chatNotification('community-sub-gift', 'Shiro', {
  notice_type: 'community_sub_gift',
  community_sub_gift: { tier: '1000', total: 25, cumulative_total: 112, id: 'gift-1' },
})

export const raid = chatNotification('raid', 'Starlight', {
  notice_type: 'raid',
  raid: {
    user: user('Starlight'),
    viewer_count: 342,
    profile_image: { url: 'https://static-cdn.jtvnw.net/user-default-pictures/raid.png' },
  },
})

export const bitsBadgeTier = chatNotification('bits-badge-tier', 'Kaedenn', {
  notice_type: 'bits_badge_tier',
  bits_badge_tier: { tier: 10000 },
})

export const charityDonation = chatNotification('charity-donation', 'Mirai', {
  notice_type: 'charity_donation',
  charity_donation: {
    name: 'Child’s Play',
    amount: { value: 50, decimal_places: 2, currency: 'USD' },
  },
})

// A notice type the item has no case for falls back to printing the type.
export const unknownNotice = chatNotification('announcement', 'Mirai', {
  notice_type: 'announcement',
  announcement: { colour: 'PRIMARY' },
})

// Twitch display names run to 25 characters.
export const longName = chatNotification('long-name', 'TheLongestNameTwitchAllow', {
  notice_type: 'sub',
  sub: { tier: '3000', prime: false, months: 1 },
})

function cheerEvent(id: string, payload: Partial<CheerPayload> & { bits: number }): CheerEvent {
  return {
    id,
    type: 'twitch.channel.cheer',
    data: {
      timestamp: TIMESTAMP,
      payload: {
        ...BROADCASTER,
        message: 'Cheer100 hype',
        is_anonymous: false,
        user_id: 'user-kaedenn',
        user_name: 'kaedenn',
        user_display_name: 'Kaedenn',
        ...payload,
      },
    },
  }
}

export const cheer = cheerEvent('cheer', { bits: 500 })

export const bigCheer = cheerEvent('big-cheer', { bits: 100000 })

export const anonymousCheer = cheerEvent('anonymous-cheer', {
  bits: 100,
  is_anonymous: true,
  user_id: null,
  user_name: null,
  user_display_name: null,
})

// A cheer with no name and no anonymous flag shows "Unknown".
export const namelessCheer = cheerEvent('nameless-cheer', {
  bits: 1,
  user_id: null,
  user_name: null,
  user_display_name: null,
})

export function follow(id: string, name: string): ChannelFollowEvent {
  return {
    id,
    type: 'twitch.channel.follow',
    data: {
      timestamp: TIMESTAMP,
      user_name: name.toLowerCase(),
      payload: {
        ...BROADCASTER,
        user_id: `user-${name.toLowerCase()}`,
        user_name: name.toLowerCase(),
        user_display_name: name,
        followed_at: TIMESTAMP,
      },
    },
  }
}
