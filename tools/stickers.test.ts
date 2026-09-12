import { describe, expect, test } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildStickerManifest, imageInfo } from './stickers'

function bytes(...parts: (number[] | string)[]): Uint8Array {
  const out: number[] = []
  for (const part of parts) {
    if (typeof part === 'string') for (const ch of part) out.push(ch.charCodeAt(0))
    else out.push(...part)
  }
  return new Uint8Array(out)
}

const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
const u16le = (n: number) => [n & 0xff, (n >> 8) & 0xff]
const u24le = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff]

/** PNG signature + IHDR, then the given chunks, then IEND. */
function pngBytes(width: number, height: number, extra: Uint8Array[] = []): Uint8Array {
  const ihdr = bytes(u32(13), 'IHDR', u32(width), u32(height), [8, 6, 0, 0, 0], u32(0))
  const iend = bytes(u32(0), 'IEND', u32(0))
  const chunks = [bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]), ihdr, ...extra, iend]
  return new Uint8Array(chunks.flatMap((c) => [...c]))
}

describe('imageInfo', () => {
  test('reads a static PNG', () => {
    expect(imageInfo(pngBytes(512, 384))).toEqual({ width: 512, height: 384, animated: false })
  })

  test('an acTL chunk marks an APNG animated', () => {
    const actl = bytes(u32(8), 'acTL', u32(3), u32(0), u32(0))
    expect(imageInfo(pngBytes(64, 64, [actl]))).toEqual({ width: 64, height: 64, animated: true })
  })

  test('reads a GIF and spots the NETSCAPE loop extension', () => {
    const still = bytes('GIF89a', u16le(120), u16le(90), [0, 0, 0])
    expect(imageInfo(still)).toEqual({ width: 120, height: 90, animated: false })
    const looping = bytes('GIF89a', u16le(120), u16le(90), [0, 0, 0, 0x21, 0xff, 0x0b], 'NETSCAPE2.0')
    expect(imageInfo(looping)?.animated).toBe(true)
  })

  test('two graphic control extensions also mean animated', () => {
    const two = bytes('GIF89a', u16le(1), u16le(1), [0, 0, 0, 0x21, 0xf9, 0x04, 0, 0, 0, 0, 0, 0x21, 0xf9, 0x04, 0, 0, 0, 0, 0])
    expect(imageInfo(two)?.animated).toBe(true)
  })

  test('reads VP8X WebP with the animation flag', () => {
    const header = (flags: number) =>
      bytes('RIFF', u32(0), 'WEBP', 'VP8X', [10, 0, 0, 0], [flags, 0, 0, 0], u24le(511), u24le(255))
    expect(imageInfo(header(0x02))).toEqual({ width: 512, height: 256, animated: true })
    expect(imageInfo(header(0x10))).toEqual({ width: 512, height: 256, animated: false })
  })

  test('reads lossless VP8L WebP', () => {
    // 14-bit width-1 = 299, 14-bit height-1 = 199, packed little-endian after the 0x2f signature.
    const w = 299, h = 199
    const b0 = w & 0xff
    const b1 = ((w >> 8) & 0x3f) | ((h & 0x03) << 6)
    const b2 = (h >> 2) & 0xff
    const b3 = (h >> 10) & 0x0f
    const header = bytes('RIFF', u32(0), 'WEBP', 'VP8L', u32(0), [0x2f, b0, b1, b2, b3], [0, 0, 0, 0, 0, 0])
    expect(imageInfo(header)).toEqual({ width: 300, height: 200, animated: false })
  })

  test('reads lossy VP8 WebP', () => {
    const header = bytes('RIFF', u32(0), 'WEBP', 'VP8 ', u32(0), [0, 0, 0, 0x9d, 0x01, 0x2a], u16le(640), u16le(360))
    expect(imageInfo(header)).toEqual({ width: 640, height: 360, animated: false })
  })

  test('anything else is null', () => {
    expect(imageInfo(bytes('JFIF nope'))).toBeNull()
    expect(imageInfo(new Uint8Array(3))).toBeNull()
  })
})

describe('buildStickerManifest', () => {
  test('globs the directory, sorts by id, skips what it cannot read', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stickers-'))
    await writeFile(join(dir, 'wow.png'), pngBytes(512, 512))
    await writeFile(join(dir, 'Blob.gif'), bytes('GIF89a', u16le(64), u16le(48), [0, 0, 0, 0x21, 0xff, 0x0b], 'NETSCAPE2.0'))
    await writeFile(join(dir, 'notes.txt'), 'not an image')
    await writeFile(join(dir, 'broken.webp'), bytes('RIFF', u32(0), 'WEBP', 'XXXX', u32(0), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
    await writeFile(join(dir, '.DS_Store'), 'junk')

    const { manifest, skipped } = await buildStickerManifest(dir)

    expect(manifest).toEqual({
      stickers: [
        { id: 'Blob', src: '/stickers/Blob.gif', width: 64, height: 48, animated: true },
        { id: 'wow', src: '/stickers/wow.png', width: 512, height: 512, animated: false },
      ],
    })
    expect(skipped.sort()).toEqual(['broken.webp', 'notes.txt'])
  })

  test('a missing directory is an empty manifest, not an error', async () => {
    const { manifest, skipped } = await buildStickerManifest('/nonexistent/stickers')
    expect(manifest).toEqual({ stickers: [] })
    expect(skipped).toEqual([])
  })
})
