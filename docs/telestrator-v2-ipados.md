# Telestrator v2 — a native iPadOS app

> Spec, 2026-09-12. Status: draft for Bryan's review; nothing built, no repo, no
> name. Written the night v1.5 was two Demi-side fixes from working (ICE bind,
> ufw), so everything below assumes v1.5's plumbing is the plumbing.
> Companion: `docs/telestrator-v1.5.md` (the web version; §9 there points here).

## 1. Why a native app at all

v1.5 gets the picture live and the browser chrome out of the way. What it
cannot do, because it is a web page:

- **Pencil feel.** Safari sees coalesced pointer events at best; there is no
  predicted-touch data and no way to draw ahead of the finger. Ink lags the
  tip by a frame or three, which is exactly the thing a telestrator is judged
  on.
- **Edge gestures.** A Pencil stroke that starts near the top or bottom edge
  can open Control Center or the Dock. A web app cannot defer system gestures;
  a native view controller can.
- **The video is a `<video>`.** Decode and present go through WebKit's media
  pipeline with no control over buffering. Native WebRTC renders straight to a
  Metal layer.
- **Reconnects are best-effort.** A Home-Screen web app that gets backgrounded
  loses its sockets and its peer connection; a native app owns its lifecycle.

Bryan's framing: a "pure telestrator", a moving picture with ink on it, not a
browser tab with a canvas.

## 2. Goals and non-goals

Goals
- The same picture v1.5 shows, with lower and steadier latency (§6).
- Ink that feels like the Pencil: predicted strokes, pressure-aware locally,
  hover cursor where the hardware has it.
- Full-screen with system edge gestures deferred, landscape, no chrome.
- **Byte-compatible with the existing stroke protocol** (§4). The OBS side,
  synthfunc's relay, and `/telestrator/output` do not change.
- Reconnects that just work: feed and socket come back on their own after
  sleep, app switch, or a Demi restart.

Non-goals
- Replacing `/telestrator/output`. The stream still renders strokes from the
  same JSON it renders today.
- Audio, two-way anything, OBS control from the iPad.
- An iPhone layout. iPad only (`TARGETED_DEVICE_FAMILY: "2"`).
- Piling this onto Skiff. Bryan, 2026-09-11: "I'd want to make a new app and
  not pile more things onto Skiff."

## 3. What v2 inherits from v1.5, unchanged

Everything below the surface. Point at the v1.5 spec rather than restating:

| Piece | v1.5 section | v2 uses it as |
| --- | --- | --- |
| OBS Virtual Camera → ffmpeg/x264 → RTSP → MediaMTX | §B, §C | the only video source |
| MediaMTX WHEP at `https://demi.tailnet-dffc.ts.net/whep/telestrator/whep` (Tailscale Serve → `127.0.0.1:8889`) | §A, §C | the WHEP endpoint, verbatim |
| synthfunc overlay socket, `telestrator:draw\|undo\|clear`, passthrough relay | §D | the stroke sink, verbatim |
| `/telestrator/output` browser source in OBS | §D | the renderer, untouched |

The ICE-bind fix pending on Demi (MediaMTX must actually listen on the
address it advertises, `100.111.202.16:8189`) applies to v2 identically: a
native WebRTC stack negotiates the same candidates the browser does.

What v2 does **not** need from v1.5: the vite preview server's `/ws` and
`/obs` proxies, the PWA manifest, the screenshot fallback. The web page stays
in synthform as the fallback surface; nothing is removed.

## 4. Wire compatibility (hard requirements)

Read from `src/hooks/use-server.ts` and `src/routes/telestrator/output.tsx`
2026-09-12. These are the bytes the app must produce.

**Envelope.** Every message is one JSON text frame:

```json
{ "type": "telestrator:draw", "payload": { ... }, "timestamp": "2026-09-12T07:00:00.000Z" }
```

**Draw payload** (`src/types/telestrator.ts`):

```json
{ "id": "1757660400000-k3j9x2a", "points": [{ "x": 0.41, "y": 0.62 }], "color": "#ff3b30", "width": 4, "done": false }
```

- `x`, `y` are **normalized 0–1 against the 16:9 program frame**, not the
  screen. The output canvas multiplies by its own width/height.
- `width` is used directly as the output canvas's `lineWidth` in output
  pixels. Constant per stroke. **There is no per-point width or pressure in
  the protocol**, so pressure-varied ink on the iPad will not appear on
  stream; see §5B for what that means.
- `id` is opaque; the output keys strokes by it. Any unique string works.
- The web client flushes buffered points every **50 ms** with `done: false`
  and sends the tail with `done: true` on pen-up. The output draws in-flight
  strokes as they arrive, so the stream shows ink while the pen is still
  down. **v2 must keep this cadence or better**; a client that only sends on
  pen-up is a regression (§5B, why pure PencilKit is out).
- `undo` and `clear` carry an empty payload `{}`.

**Socket URL.** A native app has no mixed-content rule, so it can talk to
synthfunc directly over the tailnet: `ws://saya:7178/ws/overlay/avalonstar/`,
with an ATS exception for `saya` exactly as Skiff already declares. That
removes Demi's preview proxy from the stroke path entirely. The proxied
`wss://demi.tailnet-dffc.ts.net/ws/overlay/avalonstar/` also works and is the
right choice only if Bryan wants one hostname in the app's settings. Default:
direct to saya.

**Coordinate frame.** The web page sizes its canvas to a 16:9 box letterboxed
inside the container and normalizes against that box. The iPad is not 16:9
(the 13" is 4:3, the 11" is close to 3:2), so the video will be letterboxed
either way. The drawing surface must be pinned to the **video's rendered
rect**, and normalization must divide by that rect, not the view. Touches
outside the rect are ignored (or clamped; Bryan's call, default ignore).

## 5. Design

### A. Shape of the app

Mirrors Skiff's functional-core / imperative-shell split, which is the one
Swift pattern the suite has:

- **`<Name>Core/`** — a local Swift package, no UIKit, tested with plain
  `swift test` on macOS:
  - `StrokeEncoder` — turns `(id, color, width, [points], done)` into the
    exact JSON above; `undo`/`clear` builders. Golden-file tests against
    captured frames from the web client.
  - `StrokeBatcher` — the 50 ms flush loop as a pure state machine (points
    in, batches out, `done` on end). Tested with a fake clock.
  - `FrameMapper` — view-point → normalized point given a video rect;
    letterbox math; the inverse for local redraw.
  - `WhepSignaler` — `POST` SDP offer, parse `201` + `Location`, `DELETE` on
    teardown, backoff schedule. Pure HTTP over `URLSession`, no WebRTC types,
    so it is testable without the binary framework.
  - `OverlaySocket` — envelope framing, reconnect/backoff policy, the
    `base:sync` handshake the server sends first. `URLSessionWebSocketTask`.
- **`<Name>/`** — the app target, glue only: the video view, the ink view,
  the toolbar, settings, lifecycle.

XcodeGen `project.yml` is the source of truth (Skiff's rule: anything set only
in Xcode is wiped on regeneration). Bundle id `studio.synthrack.<name>`.
Build number stamped from `git rev-list --count HEAD` by the same post-build
script. CI on the Saya runner via GitHub Actions like Skiff (`swift test` on
the Core package + an unsigned generic-iOS `xcodebuild`); Concourse's Linux
workers cannot build this, and that constraint is already recorded in
`deploy.md` for Skiff. Distribution is run-from-Xcode / TestFlight, no deploy
job.

### B. Ink — the central fork (Bryan's pick, §8)

**PencilKit exposes nothing about a stroke until the pen lifts.** Apple's own
forum answer (thread 791907): `canvasView.drawing` holds the drawing up to the
most recently *completed* stroke; there is no public access to the stroke in
progress, and they suggest filing an enhancement request. That rules out
"PencilKit and read the strokes off the delegate": the stream would get each
stroke only on pen-up, which is worse than today's 50 ms.

Three viable shapes:

1. **Custom ink view (recommended).** A `UIView` that handles touches itself:
   `coalescedTouches(for:)` for the full 240 Hz Pencil sample set,
   `predictedTouches(for:)` drawn in a separate, replaced-each-frame layer so
   the ink leads the tip, `touch.type == .pencil` to ignore the palm. Renders
   with Core Graphics into a `CALayer`, or Metal if profiling says so. Same
   polyline model as the output: constant width per stroke, `lineCap: round`,
   `lineJoin: round`. **What Bryan sees on the iPad is what the stream shows.**
   Cost: no `PKToolPicker`, so the color/width palette is ours (it is already
   ours in the web version). Apple's PencilKit "9 ms" figure is marketing; the
   honest claim for this path is "one frame behind the tip, with prediction
   covering most of it", measured in §7.

2. **PencilKit for feel, shadow recognizer for the wire.** `PKCanvasView`
   draws the local ink (pressure, tilt, nice tool picker); a parallel
   `UIGestureRecognizer` on the same view, allowed to recognize
   simultaneously, samples `location(in:)` during `.changed` and feeds the
   batcher. Cost: two renderings of every stroke that do not match. The iPad
   shows pressure-varied PencilKit ink; the stream shows a constant-width
   polyline. Bryan would be drawing with a pen that lies about what the
   audience sees. Also a coupling to PencilKit's internal gesture handling
   that Apple does not promise.

3. **Extend the protocol** to carry per-point width (pressure), then PencilKit
   locally *and* on the output. This is a cross-module change: synthfunc's
   relay is passthrough so it would not care, but `/telestrator/output` and
   `src/types/telestrator.ts` would, and the web input would send a superset.
   Real work on the synthform side, and it still does not solve in-flight
   access, so it only makes sense combined with (2). Not recommended for v2.0;
   listed so it is a known door.

Pencil interactions, all on top of whichever ink path wins:

- `UIPencilInteraction` double-tap → toggle eraser/undo (respect the user's
  system preference for double-tap, `preferredTapAction`).
- Squeeze (Pencil Pro, iPadOS 17.5+) → show the palette at the pen.
- Hover (M2 iPads + Pencil 2/Pro, iPadOS 16.1+) → a width/color cursor
  under the tip, so Bryan can see where the stroke will land before it does.
- Whether any of these exist depends on **which iPad and Pencil Bryan has**,
  which this spec does not know (§9).

### C. Video — WHEP via libwebrtc (recommended), with the alternatives named

iPadOS has no first-party WebRTC API outside WKWebView. Options:

1. **libwebrtc via SPM (recommended).** The `stasel/WebRTC` package ships
   Google's WebRTC framework as an SPM binary target, tracking Chromium
   milestones; pin a recent milestone at build time rather than in this spec.
   `RTCPeerConnection` with one `recvonly` video transceiver, offer → `POST`
   to the WHEP URL → `setRemoteDescription(answer)`, render on
   `RTCMTLVideoView` (Metal). This is exactly what v1.5's 40-line
   `useWhep` does, in Swift. It is what MediaMTX is there for.
   Cost: a ~100 MB binary dependency and a framework with Google's release
   cadence. Acceptable for a single-user app.
2. **LL-HLS via `AVPlayer`.** MediaMTX can serve it; zero third-party code;
   AVKit does everything. Latency is 2–3 s by design, which is the problem
   v1.5 exists to solve. Named so it is not re-proposed.
3. **Raw H.264 over TCP + VideoToolbox.** ffmpeg writes Annex-B to a TCP
   listener, Tailscale Serve forwards the TCP port, the app parses NAL units
   into `CMSampleBuffer`s and hands them to `AVSampleBufferDisplayLayer`.
   Lowest possible latency and no third-party binary, but it is a custom
   transport with its own reconnect, framing, and keyframe-wait logic, and it
   replaces MediaMTX rather than using it. Worth revisiting only if measured
   WebRTC latency on the iPad disappoints in §7.

Feed settings (1080p30, x264 ultrafast/zerolatency, ~6 Mbps) carry over
unchanged; the app is a consumer. Stats to show in a debug overlay: RTT,
frames decoded/dropped, jitter buffer delay (all available from
`RTCStatisticsReport`), so "it feels laggy" has a number next to it.

### D. Full-screen, orientation, gestures

`UIRequiresFullScreen` is deprecated as of iPadOS 26 and, per Apple's TN3192
(updated 2026-08-13), **ignored starting with the iOS 27 SDK**: the scene gets
resized discretely whether the app likes it or not. So v2 does not set it.
Instead:

- Scene-based lifecycle from day one (required anyway on iOS 26+).
- `UISceneSizeRestrictions` with a preferred minimum close to the full
  landscape width, so a Stage Manager window cannot be squeezed into
  something the video rect makes useless. Auto Layout for the video rect and
  ink view so an actual resize (Stage Manager, rotation) recomputes the
  letterbox and the `FrameMapper`.
- Orientation: landscape only via `supportedInterfaceOrientations`, plus
  `prefersInterfaceOrientationLocked` (iOS 26+) while the ink view is
  visible, since a rotation mid-stroke would remap coordinates under the pen.
- `prefersHomeIndicatorAutoHidden = true`, `prefersStatusBarHidden = true`.
- `preferredScreenEdgesDeferringSystemGestures = .all` — the fix for Pencil
  strokes near an edge opening Control Center or the Dock. The first swipe
  is deferred and the system shows a grabber instead of acting. This one
  line is a large part of why a native app is worth doing.
- Launch screen: required for App Store submission from iOS 27; cheap to
  include even though this is sideloaded.

### E. Lifecycle and reconnects

- Foreground: open the socket, start WHEP. Both have exponential backoff
  (1 s → 15 s, matching `use-whep.ts`) and never give up while foregrounded.
- Background: tear both down cleanly (`DELETE` the WHEP resource so MediaMTX
  drops the reader promptly). No background modes; there is nothing to do
  while the app is hidden.
- Two status dots, same semantics as the web toolbar: LINK (socket) and FEED
  (WHEP `connected` + first frame rendered). A third, PICTURE, if the feed is
  up but no frame has arrived in 2 s, which is what a stopped ffmpeg on Demi
  looks like from the iPad.
- Settings (a sheet, not a tab): WHEP URL, socket URL, default color/width.
  Defaults baked in for the tailnet names above. No credentials exist on this
  path today, so no Keychain.

## 6. Latency budget (expected, against v1.5 §5)

| Stage | v1.5 web | v2 native |
| --- | --- | --- |
| OBS → virtual camera → x264 → MediaMTX (unchanged) | ~60–140 ms | same |
| Network (tailnet, same LAN) | ~5–20 ms | same |
| Decode + render | ~50–120 ms (WebKit) | ~20–40 ms (libwebrtc VideoToolbox → Metal) |
| **Glass-to-glass** | **~0.15–0.3 s** | **~0.1–0.2 s** |
| Pencil tip → local ink | 1–3 frames, no prediction | ≤1 frame, prediction covers most |
| Pencil tip → stroke on stream | 50 ms flush + socket + relay | same (protocol-bound) |

The video gain is real but modest; the ink gain is the one Bryan will feel.
Measured, not assumed, in §7.

## 7. Verification

1. **Wire parity.** Record the web client's frames for a scripted stroke
   (draw, undo, clear) with a socket tap; assert the Core package's encoder
   produces byte-identical JSON for the same inputs (timestamps excepted).
   This is the test that keeps `/telestrator/output` untouched.
2. **Geometry.** Draw a box around the four corners of the video on the iPad;
   confirm it lands on the four corners of the OBS canvas at 1080p and at a
   Stage Manager window size.
3. **Glass-to-glass**, same method as v1.5 §7: millisecond clock in OBS,
   photograph Demi's monitor and the iPad, read the difference. Report both
   the web and native numbers side by side.
4. **Ink latency.** 240 fps slow-mo of the Pencil tip and the ink; count
   frames between tip and ink head, with and without prediction.
5. **Edge gestures.** Strokes starting at all four edges; no Control Center,
   Dock, or app switcher.
6. **Reconnects.** Restart MediaMTX; restart synthfunc; sleep/wake the iPad;
   switch apps and back. Each recovers without a relaunch, and the dots tell
   the truth throughout.
7. **Twitch unaffected**, as v1.5 §7.5.

## 8. Decisions — Bryan's, none made

1. **Name.** The rack's apps are nautical-ish (Skiff). Not choosing one here;
   three to react to, or none of them: *Slate*, *Grease* (grease pencil, the
   original telestrator tool), *Madden* (what everyone actually calls the
   thing, and a joke he may not want on a Home Screen).
2. **Repo org.** bonk went to `omnypro` (private); Skiff lives in `omnyist`.
   Either; the CI runner on Saya serves both.
3. **Ink path.** §5B: custom ink view (recommended), PencilKit + shadow
   recognizer, or a protocol extension later.
4. **Video transport.** §5C: libwebrtc/WHEP (recommended), or raw H.264 if
   measurements say WebRTC on the iPad is not good enough.
5. **Socket route.** Direct to `saya:7178` (recommended) or via Demi's proxy.
6. **iPadOS floor.** Depends on the iPad in hand (§9). iPadOS 17 matches
   Skiff and covers hover; 17.5 for Pencil Pro squeeze; 26 for the
   orientation-lock API and to be honest about the windowing model. Leaning
   26, since it is a one-device app on a device Bryan keeps current.
7. **Touches outside the video rect.** Ignore (recommended) or clamp.

## 9. Facts this spec needs and does not have

- **Which iPad and which Pencil.** Determines hover, squeeze, ProMotion, and
  the floor. Bryan can answer in one line.
- **OBS Virtual Camera output type on Demi.** If the Virtual Camera outputs
  *Program*, the feed already contains `/telestrator/output` rendered, so
  every stroke arrives on the iPad a second time ~200 ms later, baked into
  the picture under the live ink. The fix is Demi-side (Virtual Camera set to
  a scene or source that excludes the telestrator browser source) and it is
  needed for v1.5 too, not just v2. **Not yet checked**: Demi stopped
  answering SSH at 00:50 on 2026-09-12 before the probe ran. First thing in
  the morning: read `virtual-camera` out of the active scene collection in
  `~/.config/obs-studio/basic/scenes/` on Demi and confirm the source.
- **Whether synthfunc's overlay socket wants an origin or any auth** from a
  non-browser client. Reading `overlays/consumers.py` it is a passthrough
  relay keyed on tenant slug, tailnet-only; nothing suggests it does. Confirm
  with the synthfunc session before the first connection from a native
  `User-Agent` surprises anyone.

## 10. What this spec is not

Not a build order, not a repo, not a name. When Bryan has picked from §8 the
next artifact is the XcodeGen `project.yml` and the Core package with the
encoder test from §7.1 green, and nothing else, so the first commit proves the
wire before any pixel is drawn.
