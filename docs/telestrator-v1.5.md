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
      │ v1.5: WebRTC (WHEP) ◄── MediaMTX ◄── RTSP (loopback, TCP) ◄── ffmpeg/x264 ◄── OBS Virtual Camera
```

Facts checked on Demi 2026-09-11 (corrected the same night by the demi
session, which checked live state rather than trusting this list): OBS 32.2.2
with `obs-webrtc.so`, `obs-nvenc.so`; `ffmpeg` with `h264_nvenc` and `libx264`;
`docker` present; no AUR helper; `mediamtx` not in the CachyOS repos; nothing on
the rack served WebRTC/RTSP. **`v4l2loopback` 0.15.4 is loaded with
`devices=2, video_nr=20,21` and both are taken** — `/dev/video20` is LoopExt
(relay-ext.service, feeding OBS's External Capture) and `/dev/video21` is
LoopAlys. There is no free loopback device for OBS's Virtual Camera; the
first draft of this spec was wrong to say it "works". **NVENC on this RTX 4070
is the unpatched 3-session cap** and a live stream already uses 2 (Twitch
H.264 + the AV1 record/replay pair sharing one), so a third NVENC encode
would sit exactly at the wall. Demi's tailnet
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

1. **OBS Virtual Camera** → a v4l2loopback device **that does not exist yet**
   (§8, decision 5: reload the module with `devices=3` in a window Bryan is
   watching — relay-ext and relay-alys lose their loopbacks for the reload —
   or add one dynamically through `/dev/v4l2loopback`, which needs
   `v4l2loopback-ctl` built from source). Started by obs-websocket
   `StartVirtualCam` at OBS launch (synthmix's `stream-watch` already watches
   OBS lifecycle and is the natural place; or a one-shot unit). Program output,
   canvas resolution.
2. **`telestrator-feed.service`** (Demi user unit, After= OBS is up), by the
   demi session: **`libx264 -preset ultrafast -tune zerolatency`** with
   `keyint=30:min-keyint=30:scenecut=0:nal-hrd=cbr`, Baseline 4:2:0, single
   slice — not NVENC, because the third NVENC session would be the last one
   the card has and the Threadripper 7960X has idle headroom to spare. 1080p30
   per §8. Restart=on-failure; it simply retries until the virtual camera exists.

   **Ingest is RTSP into MediaMTX, not WHIP.** ffmpeg's native WHIP muxer
   (new in 2025) produced invalid FU-A packets and frame drops every 10–20 s
   that no UDP buffer change fixed; publishing the same encode as
   `-f rtsp rtsp://127.0.0.1:8554/telestrator` (TCP, loopback only — the RTSP
   listener never reaches the tailnet) let MediaMTX packetize itself: a clean
   60 s window showed zero RTP loss and zero FU-A errors. WHEP out is
   unchanged; the hop costs a few ms.

Alternative: the **Aitum Multistream** OBS plugin emitting WHIP directly (one
hop fewer, one more plugin to babysit across OBS upgrades). Not preferred.

### C. Media server — MediaMTX v1.21.0 (demi session's research, 2026-09-11)

Chosen over Broadcast Box on evidence, not the prior: both satisfy WHIP-in /
WHEP-out without transcoding, ICE over TCP and a tailnet-advertised address
(their docs, checked), but Broadcast Box v2.0.2 ships no prebuilt binaries
(Docker or `go build` only) while MediaMTX ships a static Linux binary,
checksum-verified against the release, installed the way Godot is
(`~/.local/opt/mediamtx`). SRS and LiveKit are maintained but far more
machinery than one publisher and one subscriber need. MediaMTX serves WHEP at
`POST /telestrator/whep` on `127.0.0.1:8889`; Tailscale Serve fronts it, so the
page's default `/whep/telestrator/whep` is the final URL.

The requirements the pick had to meet, kept for the record:

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

ICE candidates advertise the tailnet address. **No ufw rule**: Demi's ufw is
DROP-all with an empty ruleset and the tailnet already reaches ssh, obs-websocket
and everything else because Tailscale manages its own netfilter rules for
`tailscale0`, bypassing ufw (documented in synthlore; it is why Concourse
reaches Demi over the tailnet rather than a LAN hole). Verify the ICE UDP port
empirically once the feed exists; fall back to ICE-over-TCP if needed.
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
| ffmpeg capture + x264 ultrafast/zerolatency (CPU) | ~30–70 |
| MediaMTX RTSP→WHEP | ~15–40 |
| Network (tailnet, same LAN) | ~5–20 |
| Safari decode + render | ~50–120 |
| **Total** | **~0.15–0.3 s** |

Against today's 0–5 s. Measured, not assumed, in §7.

## 6. Ownership

| Piece | Owner |
| --- | --- |
| Tailscale Serve, MediaMTX, `telestrator-feed.service`, virtual-cam autostart | demi session (Demi dotfiles); **enabling/starting the units on the live box is Bryan's own hand** (the demi session's permission guard blocks it, correctly) |
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
   running; NVENC sessions stay at 2 because the feed encodes on the CPU.

## 8. Decisions — made 2026-09-11

1. **Origin**: Tailscale Serve on Demi. (Bryan: "that could work.")
2. **Feed resolution**: 1080p30, ~6 Mbps NVENC.
3. **Feed source**: Virtual Camera + ffmpeg. Bryan: no Aitum, "I'd want it to
   be 'transparent' and not a 'multistream'" — a second encode of program out
   that OBS itself never knows about.
4. **Media server**: MediaMTX v1.21.0, by the demi session's research (§C).
5. **Loopback device for the Virtual Camera — OPEN, Bryan's call, in a window
   he is watching**: (a) reload `v4l2loopback` with `devices=3` (relay-ext and
   relay-alys drop for the reload), or (b) build `v4l2loopback-ctl` from source
   and add a device dynamically via `/dev/v4l2loopback`. Nothing autonomous.
6. **Feed encoder**: libx264 ultrafast/zerolatency on the CPU, not NVENC (the
   card's third and last session is not worth spending here). Accepted 2026-09-11
   unless Bryan objects.

Still unanswered, not blocking: what URL the iPad opens today (nothing on the
rack serves the input page off-box, which suggests the dev server on Zelan).

## 9. v2 — the native app, so v1.5 doesn't block it

A new iPad app (not Skiff) would keep everything below the surface: it plays
the same WHEP stream from MediaMTX and sends the same `telestrator:*` messages
on synthfunc's overlay socket. What it adds is PencilKit (≈9 ms Pencil-to-pixel,
predictive strokes) and a real full-screen surface. Nothing in v1.5 is specific
to the browser except the WHEP client and the manifest, both disposable.
