# Telestrator v1.5 — a moving picture on the iPad

> Spec, 2026-09-11. Status: approved (§8); media-server research + Demi half with the demi session, synthform half in progress.
> v1.5 is the web telestrator made live and full-screen. v2 is a new native
> iPad app (not Skiff) and is out of scope here except where v1.5 should
> avoid painting it into a corner (§9).

## 1. The problem

Bryan: "the telestrator has been working perfectly EXCEPT for the screenshot
delay. it's a little bit... disorienting" and "I'm always having to deal with
Safari's browser bar."

Both are exactly what the code does today:

- `src/routes/telestrator/index.tsx` draws over `useOBSScreenshot(null, 5000)`
  — a `GetSourceScreenshot` over obs-websocket **every 5 seconds**, shown as an
  `<img>` behind the canvas. Strokes flush every 50 ms; the picture under them
  is up to 5 s old.
- The page runs in Safari, so the tab bar and toolbar sit on the drawing
  surface and swipe gestures fight the Pencil.

## 2. Goals and non-goals

Goals
- A moving image under the Pencil: ≤ ~0.5 s glass-to-glass from OBS's program
  output on Demi to the iPad, on the LAN/tailnet.
- No browser chrome: the page runs full-screen from the Home Screen.
- Same stroke path as today, unchanged: input → synthfunc overlay socket
  (`telestrator:draw|undo|clear`) → relay → `/telestrator/output` in OBS.
- No new exposure: Demi stays tailnet-only (ufw DROP-all), synthform stays
  bound to `127.0.0.1:8008` on Demi.

Non-goals
- Native app, PencilKit, stroke prediction — v2.
- Two-way audio, remote OBS control from the iPad.
- Sub-100 ms; that is a native-app conversation.

## 3. How it fits today's pieces

```
iPad (Safari → Home-Screen PWA)                Demi (Hyprland, OBS 32.2.2)
  /telestrator  ── strokes ──► synthfunc ws/overlay ──► /telestrator/output (OBS browser source)
      ▲ picture                                          ▲
      │ v1: GetSourceScreenshot every 5 s ◄──── obs-websocket :4455
      │ v1.5: WebRTC (WHEP) ◄── MediaMTX ◄── WHIP ◄── ffmpeg/NVENC ◄── OBS Virtual Camera (/dev/video20)
```

Facts checked on Demi 2026-09-11: OBS 32.2.2 with `obs-webrtc.so`, `obs-nvenc.so`;
`v4l2loopback` 0.15.4 loaded, `/dev/video20` present (OBS Virtual Camera works);
`ffmpeg` with `h264_nvenc`; `docker` present; no AUR helper; `mediamtx` not in
the CachyOS repos; nothing on the rack serves WebRTC/RTSP today. Demi's tailnet
address is `100.111.202.16` / `demi.tailnet-dffc.ts.net`. Port 8000 on Demi is
Bitfocus Companion (unrelated).

## 4. Design

### A. Origin — where the iPad loads the page from (decision needed, §8)

synthform on Demi is deliberately `127.0.0.1:8008` (2026-09-06, "Bind overlays
to localhost only"). The iPad needs a reachable, ideally HTTPS, origin — HTTPS
because the Home-Screen app and WebRTC are happiest on a secure context, and
because a tailnet cert is free.

Proposed: **Tailscale Serve on Demi**.
`tailscale serve --bg --https=443 / http://127.0.0.1:8008` and
`tailscale serve --bg --https=443 /whep http://127.0.0.1:8889` (path → MediaMTX).
Result: `https://demi.tailnet-dffc.ts.net/telestrator` for the page and
`https://demi.tailnet-dffc.ts.net/whep/telestrator/whep` for the video, both
tailnet-only, valid cert, no LAN exposure, localhost binding untouched.
Owner: demi session (Demi config).

Alternative if Serve is unwanted: the Vite dev server on Zelan (`bun run dev`,
`host: true`, port 8008) — works, but only while Zelan is running it, and over
http. Not the deploy answer.

### B. Feed — a second, low-latency encode of OBS program out

OBS's main output belongs to Twitch, so the feed is a separate path:

1. **OBS Virtual Camera** → `/dev/video20` (v4l2loopback). Started by
   obs-websocket `StartVirtualCam` at OBS launch (synthmix's `stream-watch`
   already watches OBS lifecycle and is the natural place; or a one-shot unit).
   Program output, canvas resolution.
2. **`telestrator-feed.service`** (Demi user unit, After= OBS is up):
   ```
   ffmpeg -f v4l2 -framerate 30 -video_size 1920x1080 -i /dev/video20 \
     -c:v h264_nvenc -preset p1 -tune ll -zerolatency 1 -rc cbr -b:v 6M -g 30 -bf 0 \
     -an -f whip http://127.0.0.1:8889/telestrator/whip
   ```
   (exact flags to be tuned on Demi; 1280x720 if the iPad doesn't need 1080p —
   §8). Restart=on-failure; it simply retries until the virtual camera exists.
   NVENC on an RTX 4070 has session headroom for this beside the Twitch encode.

Alternative: the **Aitum Multistream** OBS plugin emitting WHIP directly (one
hop fewer, one more plugin to babysit across OBS upgrades). Not preferred.

### C. Media server — WHIP in, WHEP out, on Demi (choice: demi session's research)

Requirements the pick must meet, whatever it is: WHIP ingest from ffmpeg and
WHEP playback to Safari (H.264, no transcoding); single process on Demi (static
binary under `~/.local/opt` like Godot, or a docker container on the host
network — there is no AUR helper); bindable to localhost with ICE advertising
the tailnet address so it never touches the LAN; ICE over TCP available if UDP
proves awkward through ufw; actively maintained; sub-100 ms internal latency.
Candidates to weigh, from lightest up: Broadcast Box (Pion authors, WHIP/WHEP
only), MediaMTX (the prior — general media server with WHIP/WHEP), SRS,
LiveKit (heavier than this needs). The config sketch below is MediaMTX's shape
and is illustrative, not a decision:

```yaml
webrtc: yes
webrtcAddress: 127.0.0.1:8889        # only via Tailscale Serve
webrtcAdditionalHosts: [100.111.202.16]
webrtcLocalUDPAddress: :8189
paths:
  telestrator: {}                    # WHIP publish, WHEP read
```

ICE candidates advertise the tailnet address; UDP 8189 must be allowed on ufw
from the tailnet only. If UDP proves awkward, MediaMTX can do ICE over TCP.
Owner: demi session.

### D. Client — synthform `src/routes/telestrator/index.tsx`

- Replace the background `<img>` with `<video autoplay muted playsinline>` fed
  by a small WHEP client (POST an SDP offer to `/whep/telestrator/whep`, set
  the answer; ~40 lines, no library). Keep the screenshot path as fallback
  when the feed isn't there, and a toggle between them.
- Drawing coordinates stay normalised to the 1920×1080 canvas as today; the
  video is letterboxed to the same box, so nothing changes for the output page.
- `VITE_TELESTRATOR_FEED_URL` (default `/whep/telestrator/whep`).
Owner: this session (synthform).

### E. Full-screen — Home-Screen web app

- `public/manifest.webmanifest`: `display: "standalone"`,
  `orientation: "landscape"`, `start_url: "/telestrator"`, icons.
- `index.html`: `<link rel="manifest">`, `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style: black-translucent`,
  `viewport-fit=cover`; the page pads for the safe area.
- Bryan adds it to the Home Screen once. iOS ≥ 16.4 runs WebRTC playback in
  home-screen apps.
Owner: this session (synthform); the one-time install is Bryan's.

## 5. Latency budget (LAN/tailnet, expected)

| Stage | ms |
| --- | --- |
| OBS compositor → virtual camera | ~16–33 |
| ffmpeg capture + NVENC low-latency | ~30–60 |
| MediaMTX WHIP→WHEP | ~10–30 |
| Network (tailnet, same LAN) | ~5–20 |
| Safari decode + render | ~50–120 |
| **Total** | **~0.15–0.3 s** |

Against today's 0–5 s. Measured, not assumed, in §7.

## 6. Ownership

| Piece | Owner |
| --- | --- |
| Tailscale Serve, MediaMTX, `telestrator-feed.service`, virtual-cam autostart, ufw UDP rule | demi session (Demi dotfiles) |
| WHEP client, video-behind-canvas, fallback, manifest/PWA | this session (synthform) |
| Add to Home Screen; 720p vs 1080p; the URL the iPad uses today | Bryan |

## 7. Verification

1. Feed alone: `ffprobe`/`curl` the WHEP endpoint from Zelan over the tailnet;
   MediaMTX logs show the WHIP publisher and one WHEP reader.
2. Glass-to-glass: an OBS text source showing a millisecond clock; photograph
   Demi's monitor and the iPad together; read the difference. Target ≤ 0.5 s,
   expected ~0.3 s.
3. Strokes: draw on the iPad, confirm `/telestrator/output` in OBS renders it
   as before (unchanged path, but re-checked after the page changes).
4. PWA: `navigator.standalone === true` on the iPad, no Safari chrome, WebRTC
   plays inside the home-screen app.
5. Twitch unaffected: OBS stats show the stream encode untouched with the feed
   running (NVENC sessions: 2).

## 8. Decisions — made 2026-09-11

1. **Origin**: Tailscale Serve on Demi. (Bryan: "that could work.")
2. **Feed resolution**: 1080p30, ~6 Mbps NVENC.
3. **Feed source**: Virtual Camera + ffmpeg. Bryan: no Aitum, "I'd want it to
   be 'transparent' and not a 'multistream'" — a second encode of program out
   that OBS itself never knows about.
4. **Media server**: not decided here. Bryan asked for the WHIP/WHEP server to
   be researched, not assumed; that research and the pick are the demi
   session's (§C). MediaMTX is the prior, not the answer.

Still unanswered, not blocking: what URL the iPad opens today (nothing on the
rack serves the input page off-box, which suggests the dev server on Zelan).

## 9. v2 — the native app, so v1.5 doesn't block it

A new iPad app (not Skiff) would keep everything below the surface: it plays
the same WHEP stream from MediaMTX and sends the same `telestrator:*` messages
on synthfunc's overlay socket. What it adds is PencilKit (≈9 ms Pencil-to-pixel,
predictive strokes) and a real full-screen surface. Nothing in v1.5 is specific
to the browser except the WHEP client and the manifest, both disposable.
