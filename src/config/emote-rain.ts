/**
 * Emote Rain Configuration
 *
 * Central configuration for the emote rain queue.
 */

// Maximum emote bodies allowed live in the physics simulation at once.
// Was a decorative "N/300" in the debug overlay with nothing enforcing it
// (spawnEmote had no cap); now the real ceiling emote-queue.ts admits
// against, with any arrivals past it queued in FIFO order.
export const EMOTE_QUEUE_MAX_CONCURRENT = 300
