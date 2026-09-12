import { readdir, readFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

/**
 * The telestrator sticker library: whatever image files are in
 * `public/stickers/` become the manifest both clients read, the output page
 * locally and Scribble over Demi's Serve root. Generated from the directory
 * at build time so adding a file is the whole job (deploy.md: glob the
 * directory the deploy owns, never an enumerated list).
 *
 * Manifest shape, agreed with the scribble session 2026-09-12:
 *   { "stickers": [ { "id", "src", "width", "height", "animated" } ] }
 * `id` is the file's basename without extension and is what travels on the
 * wire in `telestrator:sticker:place`; `src` is relative to synthform's
 * origin; `width`/`height` are intrinsic pixels so a palette can keep aspect
 * before loading; `animated` is true for GIFs and animated PNG/WebP.
 */
export interface Sticker {
  id: string
  src: string
  width: number
  height: number
  animated: boolean
}

export interface StickerManifest {
  stickers: Sticker[]
}

export interface ImageInfo {
  width: number
  height: number
  animated: boolean
}

const EXTENSIONS = new Set(['.png', '.webp', '.gif'])

/** Read dimensions and animation from the header bytes of a PNG, WebP or GIF. */
export function imageInfo(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length >= 24 && ascii(bytes, 1, 3) === 'PNG') return png(bytes)
  if (bytes.length >= 10 && ascii(bytes, 0, 3) === 'GIF') return gif(bytes)
  if (bytes.length >= 30 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return webp(bytes)
  return null
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

function u32be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 24) >>> 0) + (bytes[offset + 1]! << 16) + (bytes[offset + 2]! << 8) + bytes[offset + 3]!
}

function u16le(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! + (bytes[offset + 1]! << 8)
}

function u24le(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! + (bytes[offset + 1]! << 8) + (bytes[offset + 2]! << 16)
}

/** IHDR carries the size; an `acTL` chunk anywhere means APNG. */
function png(bytes: Uint8Array): ImageInfo {
  const width = u32be(bytes, 16)
  const height = u32be(bytes, 20)
  let animated = false
  let offset = 8
  while (offset + 8 <= bytes.length) {
    const length = u32be(bytes, offset)
    const type = ascii(bytes, offset + 4, 4)
    if (type === 'acTL') animated = true
    if (type === 'IDAT' || type === 'IEND') break
    offset += 12 + length
  }
  return { width, height, animated }
}

/**
 * The logical screen carries the size. Animation: a NETSCAPE2.0 application
 * extension (the loop count every animated GIF ships) or more than one
 * graphic control extension.
 */
function gif(bytes: Uint8Array): ImageInfo {
  const width = u16le(bytes, 6)
  const height = u16le(bytes, 8)
  const text = ascii(bytes, 0, Math.min(bytes.length, 4096))
  let controls = 0
  for (let i = 0; i + 2 < bytes.length; i++) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) controls++
    if (controls > 1) break
  }
  return { width, height, animated: text.includes('NETSCAPE2.0') || controls > 1 }
}

/** VP8X (extended, with an animation flag), VP8L (lossless) or VP8 (lossy). */
function webp(bytes: Uint8Array): ImageInfo | null {
  const chunk = ascii(bytes, 12, 4)
  if (chunk === 'VP8X') {
    return {
      width: 1 + u24le(bytes, 24),
      height: 1 + u24le(bytes, 27),
      animated: (bytes[20]! & 0x02) !== 0,
    }
  }
  if (chunk === 'VP8L') {
    const b0 = bytes[21]!, b1 = bytes[22]!, b2 = bytes[23]!, b3 = bytes[24]!
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      animated: false,
    }
  }
  if (chunk === 'VP8 ') {
    return {
      width: u16le(bytes, 26) & 0x3fff,
      height: u16le(bytes, 28) & 0x3fff,
      animated: false,
    }
  }
  return null
}

/**
 * Build the manifest from every supported image in `dir`, sorted by id.
 * `publicPath` is the URL prefix the files are served under. Files that are
 * not PNG/WebP/GIF, or whose header cannot be read, are skipped and named
 * in `skipped` so a bad drop-in is visible at build time rather than as a
 * missing sticker.
 */
export async function buildStickerManifest(
  dir: string,
  publicPath = '/stickers',
): Promise<{ manifest: StickerManifest; skipped: string[] }> {
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return { manifest: { stickers: [] }, skipped: [] }
  }
  const stickers: Sticker[] = []
  const skipped: string[] = []
  for (const name of names) {
    const ext = extname(name).toLowerCase()
    if (name.startsWith('.') || name === 'manifest.json') continue
    if (!EXTENSIONS.has(ext)) {
      skipped.push(name)
      continue
    }
    const info = imageInfo(new Uint8Array(await readFile(join(dir, name))))
    if (!info) {
      skipped.push(name)
      continue
    }
    stickers.push({
      id: basename(name, ext),
      src: `${publicPath}/${name}`,
      width: info.width,
      height: info.height,
      animated: info.animated,
    })
  }
  stickers.sort((a, b) => a.id.localeCompare(b.id))
  return { manifest: { stickers }, skipped }
}
