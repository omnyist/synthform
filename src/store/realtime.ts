/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  type MessageType,
  type PayloadType,
  type AlertData,
  type FFBotStatsMessage,
  type FFBotHireMessage,
  type FFBotChangeMessage,
  type FFBotSaveMessage,
  type ChatMessage,
  type LimitBreakData,
  type StreamStatus,
  type StreamInfo,
  type OBSSceneData,
  type OBSStreamData,
} from '@/types/server'
import type { TimelineEvent } from '@/types/events'
import type { MusicData } from '@/types/music'
import {
  INITIAL_MIC_STATUS_STATE,
  micStatusReducer,
  type MicStatusEvent,
  type MicStatusState,
} from '@/machines/mic-status'
import {
  alertStackReducer,
  createAlertStack,
  type AlertStackAction,
  type AlertStackState,
} from '@/machines/alert-stack'
import {
  createTimelineAdmission,
  timelineAdmissionReducer,
  type TimelineAdmissionAction,
  type TimelineAdmissionState,
} from '@/machines/timeline-admission'
import { TIMELINE_MAX_EVENTS } from '@/config/timeline'
import { limitBreakReducer, newLimitBreakState, type LimitBreakEvent, type LimitBreakState } from '@/machines/limitbreak'
import type { ServerConnectionPhase } from '@/machines/server-connection'
import type {
  Campaign,
  CampaignUpdatePayload,
  MilestoneUnlockedPayload,
  TimerUpdatePayload,
} from '@/types/campaign'
import { serverConnection } from '@/hooks/use-server'
import { transformTimelineEvent, type RawEvent } from './normalize'

// FFBot state from use-ffbot
type FFBotMessage = FFBotStatsMessage | FFBotHireMessage | FFBotChangeMessage | FFBotSaveMessage

interface FFBotState {
  events: FFBotMessage[]
  playerActivity: Map<
    string,
    Array<{
      type: string
      timestamp: string
      data: any
    }>
  >
  latestEvent: FFBotMessage | null
  maxEvents: number
}

// Timeline state
interface TimelineState {
  events: TimelineEvent[]
  latestEvent: TimelineEvent | null
  maxEvents: number
  lastPushTime: number
  pendingEvents: Map<string, TimelineEvent>
}

// Chat state
interface ChatState {
  messages: ChatMessage[]
  maxMessages: number
}

// Complete store interface
interface RealtimeStore {
  // Connection state
  isConnected: boolean
  connectionState: ServerConnectionPhase

  // Alert-stack machinery (machines/alert-stack.ts) — the source of truth
  // for alerts. No client-side community-gift bundling: synthfunc
  // suppresses individual gift-sub events server-side and sends one
  // alert per bundle already. See debug/alert-stack.tsx.
  alertStack: AlertStackState<AlertData>

  // Timeline-admission machinery (machines/timeline-admission.ts). Runs
  // alongside `timeline` above, gated on alertStack — not yet driving
  // anything rendered.
  timelineAdmission: TimelineAdmissionState<TimelineEvent>

  // FFBot state
  ffbot: FFBotState

  // Timeline state
  timeline: TimelineState

  // Chat state
  chat: ChatState

  // Campaign state
  campaign: Campaign | null
  campaignUpdate: CampaignUpdatePayload | null
  milestoneUnlocked: MilestoneUnlockedPayload | null
  timerUpdate: TimerUpdatePayload | null

  // Limit break state (modeled on FFXIV's limit break gauge — fills as the
  // redemption queue grows, executes on mod approval, drains to empty)
  limitbreak: LimitBreakData | null

  // Limit-break machinery (machines/limitbreak.ts) — charging/maxed/
  // executing. isMaxed on the raw data above is level-triggered (true on
  // every update while the queue sits at/above threshold); this state's
  // phase is the edge-triggered version, derived in updateMessage below.
  limitBreak: LimitBreakState

  // Music state
  music: MusicData | null

  // Stream status
  status: StreamStatus | null

  // Stream info (title, category from Twitch)
  stream: StreamInfo | null

  // Mic status from synthmix (relayed via synthmult, see mic-status-adapter.ts
  // and machines/mic-status.ts)
  synthmix: MicStatusState

  // OBS state
  obs: {
    scene: OBSSceneData | null
    stream: OBSStreamData | null
  }

  // Actions
  updateMessage: <T extends MessageType>(messageType: T, payload: PayloadType<T>) => void
  setConnectionStatus: (connected: boolean, state: ServerConnectionPhase) => void
  dispatchMicStatus: (event: MicStatusEvent) => void

  // Alert-stack machinery actions
  dispatchAlertStack: (action: AlertStackAction<AlertData>) => void
  setAlertStackCapacity: (maxConcurrent: number) => void

  // Timeline-admission machinery actions
  dispatchTimelineAdmission: (action: TimelineAdmissionAction<TimelineEvent>) => void

  // Limit-break machinery actions
  dispatchLimitBreak: (event: LimitBreakEvent) => void

  // FFBot actions (from use-ffbot logic)
  addFFBotEvent: (event: FFBotMessage) => void

  // Timeline actions
  addTimelineEvent: (event: TimelineEvent) => void
  syncTimeline: (events: TimelineEvent[]) => void
  clearTimeline: () => void
  setTimelineMaxEvents: (max: number) => void
  holdTimelineEvent: (event: TimelineEvent) => void
  releaseTimelineEvent: (eventId: string) => void
  hasAlertWithId: (eventId: string) => boolean

  // Chat actions
  addChatMessage: (message: ChatMessage) => void
}

// Create the store
export const useRealtimeStore = create<RealtimeStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isConnected: serverConnection.isConnected(),
    connectionState: serverConnection.getConnectionState(),

    // Alert-stack machinery initial state. maxConcurrent here is a
    // placeholder — real capacity is set once at startup by whatever reads
    // VITE_ALERT_STACK_MAX (see lib/alert-stack-stub-driver.ts).
    alertStack: createAlertStack<AlertData>(1),

    // Timeline-admission machinery initial state.
    timelineAdmission: createTimelineAdmission<TimelineEvent>(TIMELINE_MAX_EVENTS),

    // FFBot initial state
    ffbot: {
      events: [],
      playerActivity: new Map(),
      latestEvent: null,
      maxEvents: 100,
    },

    // Timeline initial state
    timeline: {
      events: [],
      latestEvent: null,
      maxEvents: 20,
      lastPushTime: 0,
      pendingEvents: new Map(),
    },

    // Chat initial state
    chat: {
      messages: [],
      maxMessages: 50,
    },

    // Campaign initial state
    campaign: null,
    campaignUpdate: null,
    milestoneUnlocked: null,
    timerUpdate: null,

    // Other states
    limitbreak: null,
    limitBreak: newLimitBreakState(),
    music: null,
    status: null,
    stream: null,
    synthmix: INITIAL_MIC_STATUS_STATE,
    obs: {
      scene: null,
      stream: null,
    },

    // Generic update action
    updateMessage: (messageType, payload) => {
      const state = get()

      switch (messageType) {
        // Alert messages
        case 'alerts:sync': {
          // synthfunc always sends [] here by design — the alert layer
          // starts empty on connect, no replay (consumers.py:604, confirmed
          // 2026-09-15). This loop is correct but will never run in
          // practice; kept for whenever that changes rather than assumed.
          const queue = payload as AlertData[]
          queue.forEach((alert) => {
            state.dispatchAlertStack({ type: 'stack:arrive', id: alert.id, alert })
          })
          break
        }
        case 'alerts:push': {
          const alert = payload as AlertData
          state.dispatchAlertStack({ type: 'stack:arrive', id: alert.id, alert })
          break
        }

        // FFBot messages
        case 'ffbot:stats':
        case 'ffbot:hire':
        case 'ffbot:change':
        case 'ffbot:save':
          state.addFFBotEvent(payload as FFBotMessage)
          break

        // Timeline messages
        case 'timeline:push': {
          const timelineEvent = payload as TimelineEvent
          // Server sends alerts:push before timeline:push to ensure alert is in queue
          // If matching alert exists, hold timeline event until alert completes
          if (state.hasAlertWithId(timelineEvent.id)) {
            // Hold the timeline event until alert completes
            state.holdTimelineEvent(timelineEvent)
          } else {
            // No matching alert, add directly to timeline
            state.addTimelineEvent(timelineEvent)
          }

          // Alert-stack machinery (machines/timeline-admission.ts), fed
          // additively — same idea as the block above, gated on the new
          // alertStack instead of the old alerts queue. Not yet driving
          // anything rendered; see debug/alert-stack.tsx. Transformed the
          // same way addTimelineEvent/holdTimelineEvent above already do
          // — every other timeline write path normalizes the raw event
          // first, this one shouldn't be the exception.
          const transformedEvent = transformTimelineEvent(timelineEvent as RawEvent | TimelineEvent)
          const isAlertActive =
            state.alertStack.active.some((instance) => instance.id === transformedEvent.id) ||
            state.alertStack.backlog.some((item) => item.id === transformedEvent.id)
          state.dispatchTimelineAdmission(
            isAlertActive
              ? { type: 'timeline:queued', id: transformedEvent.id, event: transformedEvent }
              : { type: 'timeline:admitted', id: transformedEvent.id, event: transformedEvent },
          )
          break
        }
        case 'timeline:sync': {
          const rawEvents = payload as TimelineEvent[]
          state.syncTimeline(rawEvents)

          // Not gated against alertStack like timeline:push above — a
          // sync batch is a snapshot of already-settled history (the old
          // syncTimeline doesn't gate per-event either), so every synced
          // event goes straight to visible.
          rawEvents.forEach((event) => {
            const transformedEvent = transformTimelineEvent(event as RawEvent | TimelineEvent)
            state.dispatchTimelineAdmission({
              type: 'timeline:admitted',
              id: transformedEvent.id,
              event: transformedEvent,
            })
          })
          break
        }

        // Chat messages
        case 'chat:message':
          state.addChatMessage(payload as ChatMessage)
          break
        case 'chat:sync':
          // Replace all messages with synced history
          set((state) => ({
            chat: {
              ...state.chat,
              messages: payload as ChatMessage[]
            }
          }))
          break

        // Campaign messages
        case 'campaign:sync':
          set({ campaign: payload as Campaign })
          break
        case 'campaign:update': {
          // Store the update AND merge into main campaign state
          const update = payload as CampaignUpdatePayload
          set((state) => ({
            campaignUpdate: update,
            // Merge the update into the campaign's metric
            campaign: state.campaign
              ? {
                  ...state.campaign,
                  metric: {
                    ...state.campaign.metric,
                    total_subs: update.total_subs ?? state.campaign.metric.total_subs,
                    total_resubs: update.total_resubs ?? state.campaign.metric.total_resubs,
                    total_bits: update.total_bits ?? state.campaign.metric.total_bits,
                    timer_seconds_remaining:
                      update.timer_seconds_remaining ??
                      state.campaign.metric.timer_seconds_remaining,
                    extra_data: update.extra_data ?? state.campaign.metric.extra_data,
                  },
                }
              : null,
          }))
          break
        }
        case 'campaign:milestone': {
          // Store the milestone AND update the campaign's milestones
          const milestone = payload as MilestoneUnlockedPayload
          set((state) => ({
            milestoneUnlocked: milestone,
            // Update the milestone in the campaign's milestones array
            campaign: state.campaign
              ? {
                  ...state.campaign,
                  milestones: state.campaign.milestones.map((m) =>
                    m.id === milestone.id
                      ? { ...m, is_unlocked: true, unlocked_at: new Date().toISOString() }
                      : m,
                  ),
                }
              : null,
          }))
          break
        }
        case 'campaign:timer:started':
        case 'campaign:timer:paused':
        case 'campaign:timer:tick': {
          // Store the timer update AND merge into campaign metric
          const timerPayload = payload as TimerUpdatePayload
          set((state) => ({
            timerUpdate: timerPayload,
            // Update timer fields in the campaign's metric
            campaign: state.campaign
              ? {
                  ...state.campaign,
                  metric: {
                    ...state.campaign.metric,
                    timer_seconds_remaining:
                      timerPayload.timer_seconds_remaining ??
                      state.campaign.metric.timer_seconds_remaining,
                    timer_started_at: timerPayload.timer_started
                      ? new Date().toISOString()
                      : state.campaign.metric.timer_started_at,
                    timer_paused_at: timerPayload.timer_paused
                      ? new Date().toISOString()
                      : timerPayload.timer_started === false
                        ? null
                        : state.campaign.metric.timer_paused_at,
                  },
                }
              : null,
          }))
          break
        }

        // Limit break messages
        case 'limitbreak:sync':
        case 'limitbreak:update': {
          const limitBreakData = payload as LimitBreakData
          // isMaxed is level-triggered (true on every update while the
          // queue sits at/above threshold) — derive the charging->maxed
          // edge here, before this update overwrites the previous value.
          const wasMaxed = state.limitbreak?.isMaxed ?? false
          set({ limitbreak: limitBreakData })
          if (!wasMaxed && limitBreakData.isMaxed) {
            state.dispatchLimitBreak('bars:maxed')
          }
          break
        }
        case 'limitbreak:executed':
          state.dispatchLimitBreak('limitbreak:executed')
          break

        // Music messages
        case 'music:sync':
        case 'music:update':
          set({ music: payload as MusicData })
          break

        // Status messages
        case 'status:sync':
        case 'status:update':
          set({ status: payload as StreamStatus })
          break

        // Stream info messages (title, category from Twitch)
        case 'stream:sync':
        case 'stream:update':
          set({ stream: payload as StreamInfo })
          break

        // OBS messages
        case 'obs:sync':
          {
            const obsPayload = payload as PayloadType<'obs:sync'>
            set({
              obs: {
                scene: {
                  current_scene: obsPayload.current_scene,
                  scenes: obsPayload.scenes,
                },
                stream: {
                  streaming: obsPayload.streaming,
                  recording: obsPayload.recording,
                  stream_time: obsPayload.stream_time,
                  record_time: obsPayload.record_time,
                },
              },
            })
          }
          break
        case 'obs:update':
          set({
            obs: {
              ...state.obs,
              stream: payload as OBSStreamData,
            },
          })
          break
      }
    },

    setConnectionStatus: (connected, connectionState) => {
      set({ isConnected: connected, connectionState })
    },

    dispatchMicStatus: (event) => {
      set((state) => ({ synthmix: micStatusReducer(state.synthmix, event) }))
    },

    dispatchAlertStack: (action) => {
      set((state) => ({ alertStack: alertStackReducer(state.alertStack, action) }))

      // Cross-machine coupling lives here, not in either pure machine —
      // alert-stack.ts and timeline-admission.ts never import each other.
      // A reaped alert is the signal that releases its matching timeline
      // event, if it was ever held (a safe no-op if not) — for both the
      // new machinery and the old holdTimelineEvent/releaseTimelineEvent
      // mechanism above, which is still what actually drives the
      // rendered Timeline and used to be released from use-alerts.ts's
      // onAlertComplete.
      if (action.type === 'stack:reap') {
        get().dispatchTimelineAdmission({ type: 'timeline:released', id: action.id })
        get().releaseTimelineEvent(action.id)
      }
    },

    setAlertStackCapacity: (maxConcurrent) => {
      set((state) => ({ alertStack: { ...state.alertStack, maxConcurrent } }))
    },

    dispatchTimelineAdmission: (action) => {
      set((state) => ({ timelineAdmission: timelineAdmissionReducer(state.timelineAdmission, action) }))
    },

    dispatchLimitBreak: (event) => {
      // A re-max during 'executing' is remembered inside the reducer
      // itself (machines/limitbreak.ts's maxedDuringExecuting) and
      // replayed the instant audio:ended lands — no need to re-read raw
      // wire data here to catch up, which would be racing the actual
      // post-execution reset update rather than trusting the real edge
      // that was already observed.
      set((state) => ({ limitBreak: limitBreakReducer(state.limitBreak, event) }))
    },

    // FFBot actions (copied from use-ffbot)
    addFFBotEvent: (event) => {
      set((state) => {
        const events = [...state.ffbot.events, event]

        // Trim events if exceeding max
        if (events.length > state.ffbot.maxEvents) {
          events.splice(0, events.length - state.ffbot.maxEvents)
        }

        // Update player activity tracking
        const playerActivity = new Map(state.ffbot.playerActivity)
        if ('player' in event && event.player) {
          const activities = playerActivity.get(event.player) || []

          // Determine event type from message structure
          let eventType = 'unknown'
          if ('character' in event && 'cost' in event) {
            eventType = 'hire'
          } else if ('from' in event && 'to' in event) {
            eventType = 'change'
          } else if ('data' in event) {
            eventType = 'stats'
          } else if ('player_count' in event) {
            eventType = 'save'
          }

          activities.push({
            type: eventType,
            timestamp: event.timestamp,
            data: event,
          })

          // Keep only last 10 activities per player
          if (activities.length > 10) {
            activities.splice(0, activities.length - 10)
          }

          playerActivity.set(event.player, activities)
        }

        return {
          ffbot: {
            ...state.ffbot,
            events,
            playerActivity,
            latestEvent: event,
          },
        }
      })
    },

    // Timeline actions
    addTimelineEvent: (event) => {
      set((state) => {
        // Transform the event if needed
        const transformedEvent = transformTimelineEvent(event as RawEvent | TimelineEvent)

        // Add to beginning and trim to max
        const events = [transformedEvent, ...state.timeline.events].slice(
          0,
          state.timeline.maxEvents,
        )

        return {
          timeline: {
            ...state.timeline,
            events,
            latestEvent: transformedEvent,
            lastPushTime: Date.now(),
          },
        }
      })
    },

    syncTimeline: (events) => {
      set((state) => {
        // Transform all events and slice to max
        const rawEvents = Array.isArray(events) ? events : [events]
        const transformedEvents = rawEvents
          .map((e) => transformTimelineEvent(e as RawEvent | TimelineEvent))
          .slice(0, state.timeline.maxEvents)

        return {
          timeline: {
            ...state.timeline,
            events: transformedEvents,
            latestEvent: transformedEvents[0] || null,
          },
        }
      })
    },

    clearTimeline: () => {
      set((state) => ({
        timeline: {
          ...state.timeline,
          events: [],
          latestEvent: null,
        },
      }))
    },

    setTimelineMaxEvents: (max) => {
      set((state) => ({
        timeline: {
          ...state.timeline,
          maxEvents: max,
          events: state.timeline.events.slice(0, max),
        },
      }))
    },

    holdTimelineEvent: (event) => {
      set((state) => {
        const pendingEvents = new Map(state.timeline.pendingEvents)
        pendingEvents.set(event.id, event)
        return {
          timeline: {
            ...state.timeline,
            pendingEvents,
            lastPushTime: Date.now(), // Update lastPushTime to trigger timeline visibility
          },
        }
      })
    },

    releaseTimelineEvent: (eventId) => {
      set((state) => {
        const pendingEvents = new Map(state.timeline.pendingEvents)
        const event = pendingEvents.get(eventId)

        if (!event) return state

        pendingEvents.delete(eventId)

        // Add the released event to the timeline
        const transformedEvent = transformTimelineEvent(event as RawEvent | TimelineEvent)
        const events = [transformedEvent, ...state.timeline.events].slice(
          0,
          state.timeline.maxEvents,
        )

        return {
          timeline: {
            ...state.timeline,
            events,
            latestEvent: transformedEvent,
            lastPushTime: Date.now(),
            pendingEvents,
          },
        }
      })
    },

    hasAlertWithId: (eventId) => {
      const state = get()
      // Sourced from alertStack, not the old alerts queue — the old
      // holdTimelineEvent/releaseTimelineEvent mechanism above is still
      // live (still driving the real rendered Timeline), just now gated
      // on the real source of truth for "is there a matching alert".
      return (
        state.alertStack.active.some((instance) => instance.id === eventId) ||
        state.alertStack.backlog.some((item) => item.id === eventId)
      )
    },

    // Chat actions
    addChatMessage: (message) => {
      set((state) => {
        const messages = [...state.chat.messages, message]

        // Trim messages if exceeding max
        if (messages.length > state.chat.maxMessages) {
          messages.splice(0, messages.length - state.chat.maxMessages)
        }

        return {
          chat: {
            ...state.chat,
            messages,
          },
        }
      })
    },
  })),
)
