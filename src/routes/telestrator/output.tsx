import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useCallback, useState } from 'react'
import { serverConnection } from '@/hooks/use-server'
import type { MessageType } from '@/types/server'
import type {
  TelestratorDrawData,
  TelestratorPoint,
  TelestratorStickerMoveData,
  TelestratorStickerPlaceData,
} from '@/types/telestrator'

export const Route = createFileRoute('/telestrator/output')({
  component: TelestratorOutput,
})

const FRAME_WIDTH = 1920
const FRAME_HEIGHT = 1080

interface Stroke {
  id: string
  points: TelestratorPoint[]
  color: string
  width: number
  done: boolean
}

interface Sticker {
  id: string
  sticker: string
  x: number
  y: number
  scale: number
  rotation: number
}

/** One entry of `/stickers/manifest.json`, generated at build from `public/stickers/`. */
interface ManifestSticker {
  id: string
  src: string
  width: number
  height: number
  animated: boolean
}

/**
 * The OBS browser source. Strokes render on a canvas; stickers are `<img>`
 * elements over it, positioned from their normalized centre, sized from
 * `scale` (a fraction of the frame width) and rotated clockwise. Strokes and
 * stickers live in one ordered stack: undo removes whichever finished last,
 * clear removes everything. Stickers always draw above ink.
 */
function TelestratorOutput() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Map<string, Stroke>>(new Map())
  const stickersRef = useRef<Map<string, Sticker>>(new Map())
  /** Ids in the order they finished (stroke done, sticker placed); undo pops. */
  const orderRef = useRef<string[]>([])
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [library, setLibrary] = useState<Map<string, ManifestSticker>>(new Map())

  // The sticker library, once; preloaded so the first placement does not
  // pop in late. A missing manifest leaves the library empty and stickers
  // for unknown ids simply do not render.
  useEffect(() => {
    let cancelled = false
    fetch('/stickers/manifest.json')
      .then((res) => (res.ok ? res.json() : { stickers: [] }))
      .then((manifest: { stickers: ManifestSticker[] }) => {
        if (cancelled) return
        const map = new Map(manifest.stickers.map((s) => [s.id, s]))
        for (const s of map.values()) new Image().src = s.src
        setLibrary(map)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    strokesRef.current.forEach((stroke) => {
      if (stroke.points.length < 2) return

      ctx.beginPath()
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      const first = stroke.points[0]
      if (!first) return
      ctx.moveTo(first.x * canvas.width, first.y * canvas.height)

      for (let i = 1; i < stroke.points.length; i++) {
        const point = stroke.points[i]
        if (!point) continue
        ctx.lineTo(point.x * canvas.width, point.y * canvas.height)
      }

      ctx.stroke()
    })
  }, [])

  const publishStickers = useCallback(() => {
    setStickers([...stickersRef.current.values()])
  }, [])

  useEffect(() => {
    const handleDraw = (data: unknown) => {
      const drawData = data as TelestratorDrawData
      const existing = strokesRef.current.get(drawData.id)

      if (existing) {
        existing.points = existing.points.concat(drawData.points)
        existing.done = drawData.done
      } else {
        strokesRef.current.set(drawData.id, {
          id: drawData.id,
          points: [...drawData.points],
          color: drawData.color,
          width: drawData.width,
          done: drawData.done,
        })
      }

      if (drawData.done) {
        orderRef.current.push(drawData.id)
      }

      redraw()
    }

    const handlePlace = (data: unknown) => {
      const place = data as TelestratorStickerPlaceData
      stickersRef.current.set(place.id, {
        id: place.id,
        sticker: place.sticker,
        x: place.x,
        y: place.y,
        scale: place.scale,
        rotation: place.rotation,
      })
      orderRef.current.push(place.id)
      publishStickers()
    }

    const handleMove = (data: unknown) => {
      const move = data as TelestratorStickerMoveData
      const existing = stickersRef.current.get(move.id)
      if (!existing) return
      existing.x = move.x
      existing.y = move.y
      existing.scale = move.scale
      existing.rotation = move.rotation
      publishStickers()
    }

    const handleUndo = () => {
      const lastId = orderRef.current.pop()
      if (!lastId) return
      if (strokesRef.current.delete(lastId)) redraw()
      if (stickersRef.current.delete(lastId)) publishStickers()
    }

    const handleClear = () => {
      strokesRef.current.clear()
      stickersRef.current.clear()
      orderRef.current = []
      redraw()
      publishStickers()
    }

    const drawType = 'telestrator:draw' as MessageType
    const placeType = 'telestrator:sticker:place' as MessageType
    const moveType = 'telestrator:sticker:move' as MessageType
    const undoType = 'telestrator:undo' as MessageType
    const clearType = 'telestrator:clear' as MessageType

    serverConnection.subscribe(drawType, handleDraw as any)
    serverConnection.subscribe(placeType, handlePlace as any)
    serverConnection.subscribe(moveType, handleMove as any)
    serverConnection.subscribe(undoType, handleUndo as any)
    serverConnection.subscribe(clearType, handleClear as any)

    return () => {
      serverConnection.unsubscribe(drawType, handleDraw as any)
      serverConnection.unsubscribe(placeType, handlePlace as any)
      serverConnection.unsubscribe(moveType, handleMove as any)
      serverConnection.unsubscribe(undoType, handleUndo as any)
      serverConnection.unsubscribe(clearType, handleClear as any)
    }
  }, [redraw, publishStickers])

  return (
    <div
      className="relative overflow-hidden"
      style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT, background: 'transparent' }}
    >
      <canvas
        ref={canvasRef}
        width={FRAME_WIDTH}
        height={FRAME_HEIGHT}
        className="absolute inset-0 block"
        style={{ background: 'transparent' }}
      />
      {stickers.map((s) => {
        const entry = library.get(s.sticker)
        if (!entry) return null
        const width = s.scale * FRAME_WIDTH
        return (
          <img
            key={s.id}
            src={entry.src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute select-none"
            style={{
              left: s.x * FRAME_WIDTH,
              top: s.y * FRAME_HEIGHT,
              width,
              height: (width * entry.height) / entry.width,
              transform: `translate(-50%, -50%) rotate(${s.rotation}deg)`,
            }}
          />
        )
      })}
    </div>
  )
}
