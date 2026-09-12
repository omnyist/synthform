/**
 * The millisecond timecode ffmpeg burns into the top-left corner of the
 * telestrator feed on Demi, read back from the decoded frame. Same contract
 * as Scribble's `FrameStamp` (ScribbleCore) and `hosts/demi/mediamtx/
 * stamp.filter` in Demi's dotfiles; the layout constants below must match
 * both. This is the third reader of that layout.
 *
 * Layout, in 1080p frame pixels: a black bar BAR_WIDTH × BAR_HEIGHT at the
 * origin; BLOCK squares along y = ORIGIN, the first at x = ORIGIN. Square 0
 * is black and square 1 white as the two references; squares 2… carry the
 * low BITS bits of the frame's wall-clock milliseconds, most significant
 * first, white for 1.
 */

const STAMP_BITS = 24
const STAMP_BLOCK = 16
const STAMP_ORIGIN = 16
export const STAMP_BAR_WIDTH = STAMP_ORIGIN * 2 + STAMP_BLOCK * (STAMP_BITS + 2)
export const STAMP_BAR_HEIGHT = STAMP_ORIGIN * 2 + STAMP_BLOCK
export const STAMP_REFERENCE_WIDTH = 1920
export const STAMP_REFERENCE_HEIGHT = 1080
const MODULUS = 2 ** STAMP_BITS

/**
 * Decode the stamp from a luma lookup over a frame of `width` × `height`;
 * positions scale from the 1080p layout. Each square is the median of a 3×3
 * patch at its centre, thresholded halfway between the two references, so
 * limited range and a soft encoder do not matter. Null when the references
 * are not clearly apart, which is what an unstamped feed looks like.
 */
export function decodeStamp(
  width: number,
  height: number,
  luma: (x: number, y: number) => number,
): number | null {
  const sx = width / STAMP_REFERENCE_WIDTH
  const sy = height / STAMP_REFERENCE_HEIGHT
  const sample = (square: number) => {
    const cx = Math.floor((STAMP_ORIGIN + STAMP_BLOCK * square + STAMP_BLOCK / 2) * sx)
    const cy = Math.floor((STAMP_ORIGIN + STAMP_BLOCK / 2) * sy)
    const values: number[] = []
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = Math.min(Math.max(cx + dx, 0), width - 1)
        const y = Math.min(Math.max(cy + dy, 0), height - 1)
        values.push(luma(x, y))
      }
    }
    values.sort((a, b) => a - b)
    return values[4] ?? 0
  }
  const black = sample(0)
  const white = sample(1)
  if (white - black < 64) return null
  const threshold = (black + white) / 2
  let value = 0
  for (let i = 0; i < STAMP_BITS; i++) {
    value = value * 2 + (sample(2 + i) > threshold ? 1 : 0)
  }
  return value
}

/**
 * Milliseconds from the stamped frame time to `nowMs` on the receiver's
 * clock, given `offsetMs` = receiver clock − sender clock. Modular in BITS; a
 * result past half the range is a misread, not a lag, and comes back null.
 */
export function stampLag(nowMs: number, stamp: number, offsetMs: number): number | null {
  const senderNow = Math.floor(nowMs - offsetMs)
  const difference = (((senderNow - stamp) % MODULUS) + MODULUS) % MODULUS
  return difference < MODULUS / 2 ? difference : null
}

/** Milliseconds by which the NTP epoch (1900) leads the Unix epoch (1970). */
const NTP_TO_UNIX_MS = 2_208_988_800_000

/**
 * Browsers have reported sender-clock values on the NTP epoch in some builds
 * and the Unix epoch in others. Only differences between sender-side values
 * matter, so this guards against a pair being on different epochs.
 */
export function normalizeSenderClock(ms: number): number {
  return ms > 3.0e12 ? ms - NTP_TO_UNIX_MS : ms
}
