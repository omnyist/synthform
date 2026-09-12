export interface TelestratorPoint {
  x: number // 0–1 normalized
  y: number // 0–1 normalized
}

export interface TelestratorDrawData {
  id: string
  points: TelestratorPoint[]
  color: string
  width: number
  done: boolean
}

/**
 * A sticker dropped onto the frame (contract landed in standards 701c262,
 * 2026-09-12). `sticker` is an id from `/stickers/manifest.json`, the file's
 * basename; `x`/`y` are the sticker's centre normalized 0–1 like a point;
 * `scale` is the rendered width as a fraction of the frame width (0.1 is
 * 192 px on the 1080p canvas); `rotation` is degrees clockwise, 0 default.
 */
export interface TelestratorStickerPlaceData {
  id: string
  sticker: string
  x: number
  y: number
  scale: number
  rotation: number
}

/**
 * The same sticker being dragged, pinched or twisted, batched at the stroke
 * cadence; `done` true on release. A move for an unknown id is ignored.
 */
export interface TelestratorStickerMoveData {
  id: string
  x: number
  y: number
  scale: number
  rotation: number
  done: boolean
}
