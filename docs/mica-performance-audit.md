# Mica — performance audit and animation optimisation

Mica is the AI assistant orb on every authenticated page of the web app and on the
mobile shell. This is the record of why it arrived late and stuttered, what was
changed, and what the numbers look like now.

The short version: nothing about the orb was slow to *compute*. Three costs added
up to the same symptom.

1. **The orb's motion was JavaScript.** Seven infinite animation loops (via
   framer-motion) were restarted on every state change, on layers that carried a
   `filter: blur(42px)` and a 60px `box-shadow` — so every frame re-rasterised a
   blur and a shadow.
2. **The microphone's amplitude was React state.** A number changing ~60 times a
   second re-rendered the whole assistant subtree once per frame: measured at 42
   commits and 2339 ms of render work across 30 audio frames.
3. **The assistant's UI was on every page's critical path.** The overlay, the bar
   and the animation library they use were imported by the shell, so every page
   parsed them before the orb could paint — 43.8 kB gzip of it.

And two ordering bugs, both of which made a tap look dead:

4. On a cold cache the assistant's UI is a lazy chunk, and the entry point hides
   itself the instant a session exists: the tap showed an empty screen until the
   chunk landed.
5. `startListening` awaited the microphone probe **before** entering `listening`,
   so on a first use the state change waited for the person answering the
   browser's permission dialog.

## How the numbers in this document were taken

| What | How | Reproducible |
|---|---|---|
| React work per audio frame | `apps/web/src/components/mica/mica.renderBudget.test.tsx` — drives the real meter, counts commits through React's `<Profiler>` and prints its own result | `npx vitest run src/components/mica/mica.renderBudget.test.tsx` |
| Bytes on the first-load path | `scripts/perf/first-load.mjs` — walks `dist/index.html`, then every **static** import and stylesheet, and gzips the files | `node scripts/perf/first-load.mjs apps/web/dist [--list]` |
| Orb present on the shell's first commit | `mica.renderBudget.test.tsx` ("renders the orb without waiting for anything asynchronous") | as above |
| Mobile geometry / states | `apps/mobile/src/components/__tests__/FloatingMicaOrb.test.tsx` | `cd apps/mobile && npx jest src/components` |

Frame rate on real devices, first paint in a production browser and the
microphone→speech→reply→playback timings were **not** measured here; see
"What could not be verified" at the end. Nothing below is presented as a device
measurement unless it says so.

## Confirmed causes

Every claim here was read out of the committed code, not inferred.

**The orb animated with JavaScript, and animated the expensive properties.**
`git show HEAD:apps/web/src/components/mica/MicaOrb.tsx` imports
`motion, useMotionValue, useSpring, useTransform, animate` from framer-motion, and
applies `filter: blur(18px | 42px)` and `boxShadow: 0 0 30px | 60px` to the layers
it scales. The glow was a *blurred disc being scaled*, and the halo a 60px shadow
being scaled — a blur or a shadow has to be recomputed when the layer it belongs
to changes size, on every frame, on the main thread.

**The amplitude arrived as a React prop.** `MicaOrb` took `audioLevel?: number`,
and the overlay and the bar re-rendered to pass it. The bar additionally restarted
its 180 ms scale animation on every frame, so the animation never once finished and
the strip juddered for the whole session. Measured: `42 commits / 2339 ms` across
30 frames (and ~`120 commits / 120 frames` on the first harness run), on a level
that *varies* every frame the way a microphone's does.

**The assistant's UI was in the entry chunk.** `MicaProvider` imported the overlay
and the bar directly, and through them framer-motion — which, at that point, had
Mica as its only consumer in this app. So every page in the product evaluated the
whole assistant before painting an orb it might never be asked to use.

**A live session's hidden orbs kept animating.** Both entry points
(`MicaFab` in the shell, `MicaAssistant` on the dashboard) hid themselves with
`display: none` while a session was live. A hidden orb is still a mounted orb: its
breathing, orbit and glow loops kept asking for frames behind whatever was on
screen — twice on the dashboard.

**Two ordering bugs made the tap look dead.** The surfaces became a lazy chunk,
and the entry points unmount when a session exists — so on a cold cache the first
tap had nothing to show. Separately, the state change was the *last* thing
`startListening` did, after the permission probe, the audio meter and the
recogniser.

**On mobile, the only motion was the drag, and it was not native.** The committed
`FloatingMicaOrb` animated its position through `left`/`top` with
`useNativeDriver: false`: every drag frame went through JavaScript and then a
layout pass on a shadow-casting view — the most expensive way to move a circle.
The state visuals themselves were static (an image swap). Its drag bounds were
also computed from the raw window while the orb lives inside an inset frame, so a
dragged orb could be parked on the tab bar, and `homeY` sat a fixed 160px from the
bottom on every device — inside the home indicator on a gesture-bar phone.

## What changed

### Web — `apps/web/src/components/mica/`

| File | Change |
|---|---|
| `MicaOrb.tsx` | Rewritten as a *visual* component with three inputs (`state`, an audio channel, `onPress`) and no lifecycle. Motion moved to CSS; no animation library, no blur, no animated shadow; the halo is a static layer. |
| `mica-orb.css` *(new)* | The orb's motion as CSS keyframes keyed off `data-mica-state`, all on `transform`/`opacity`. A state change is an attribute write; the browser's animation layer does the rest, and there is nothing to leak. |
| `mica.audio.ts` *(new)* | The amplitude channel: the meter publishes a level, the orb subscribes and writes it straight onto two elements' `transform`. No React state, no render. |
| `mica.motion.ts` *(new)* | `usePrefersReducedMotion` and `useDocumentVisible`. Reduced motion means *still*; document-hidden pauses the ambient motion. |
| `mica.surfaces.tsx` *(new)* | The overlay and the bar as `lazy()` chunks, plus `preloadMicaSurfaces()` — the intent prefetch used by both entry points. |
| `MicaProvider.tsx` | Keeps the one session for the shell (already the case before this work), draws the **pending surface** while the lazy chunk is in flight, and warms the chunk the moment a session exists (so keyboards and assistive tech, which fire no pointer events, get it too). |
| `MicaFab.tsx`, `MicaAssistant.tsx` | Return `null` while a session is live instead of `display: none`; prefetch the surfaces on pointer enter / pointer down / focus; the resting orb carries the audio channel. |
| `MicaOverlay.tsx` | Takes the channel instead of an `audioLevel` number. |
| `MicaMiniBar.tsx` | Takes the channel; the pulse ring is a framer-motion motion value driven at the source, so it is a composited transform and the bar re-renders only when what it *says* changes. Owns its own presence (`open`) so the exit animation is not the provider's business. |
| `useMica.ts` | Publishes amplitude into the channel; **the session state changes on the tap** rather than after the microphone probe; a session ended during the permission dialog cannot open a recogniser afterwards. |

### Mobile — `apps/mobile/src/`

| File | Change |
|---|---|
| `components/FloatingMicaOrb.tsx` | Position laid out once at home and moved by `translateX`/`translateY` with `useNativeDriver: true` (drag *and* snap). Breathing, glow and the listening ring as Reanimated shared values on the UI thread. `AppState` parks it when backgrounded. `orbBounds()` extracted and proved: the whole box plus the caller's bottom clearance stays above the frame's bottom edge, so the orb cannot be parked on the navigation. |
| `utils/useReducedMotion.ts` *(new)* | One implementation for every animated surface, reading the setting *and* its change event. |
| `components/MeticleSplashBackground.tsx` | Uses that hook instead of its own copy of it. |
| `jest.setup.ts` | The Reanimated stand-in gains `cancelAnimation`, which the orb calls on every state change and on unmount. |

### Tests

New: `mica.renderBudget.test.tsx` (React work per audio frame, orb-on-first-commit),
`mica.pendingSurfaces.test.tsx` (the tap when the chunk never arrives),
`mica.sessionStart.test.tsx` (the session starts before the microphone probe, a
refusal is a notice rather than a modal, and a cancelled session opens no
recogniser). Updated: `MicaOrb`, `MicaOverlay`, `MicaMiniBar`, `mica.identity`,
`useMica.intents` and `MicaProvider.navigation`; on mobile, the orb's geometry and
state vocabulary, with the splash's reduced-motion path.

## The animation strategy

**Web.** No JavaScript per frame. The orb is markup whose `data-mica-state`
selects a CSS keyframe set; every keyframe animates only `transform` and `opacity`,
so the work is a composited transform and nothing is re-rasterised. There is no
blur on any animated layer — the ambient glow is a radial gradient fading to
transparent, which scales as a composited layer and looks the same as the blurred
disc it replaced — and the hugging halo never animates at all, so it is rasterised
once. `will-change` is not sprinkled around; the layers that animate are the only
ones promoted. The microphone level is a style write on two elements from a
subscription, not a render. Document-hidden pauses motion; reduced motion stops it,
including the amplitude response, so nothing moves quietly for a user who asked it
not to.

**Mobile.** The same three visual states, driven the way this app already drives
continuous motion: Reanimated shared values, so the animation runs on the UI thread
at the display's own rate and a JavaScript thread busy with a roster fetch or an
upload cannot stutter it. Idle is a slow breath and a soft glow; listening adds a
ring travelling outwards and fading; thinking and responding are contained and
calmer; error is deliberately *still* — a loop reads as progress, and a failure is
not progressing. Every animated property is a transform or an opacity, which is
also what lets the drag use the native driver. The drag and its snap spring use
React Native's own `Animated` with `useNativeDriver: true` — already a dependency,
no new one — while the continuous state motion uses Reanimated, which was already
in the app for the launch splash. No Lottie, no GIF, no second animation library.
`AppState` and reduced motion park the same shared values, so there is exactly one
place that starts and stops the motion and no way for the two to disagree.

## How unnecessary renders were reduced

- The amplitude no longer *is* React state anywhere. It is published to a channel
  (`mica.audio.ts`), the orb subscribes and writes `transform`, and `useMica`
  mirrors it into a ref for the voice-activity timer. Nothing in the render tree
  needs it.
- The bar's pulse became a motion value, so the strip re-renders only when its
  transcript or state copy changes.
- The surfaces that are not the orb load on demand, so a page that never opens Mica
  never evaluates them.
- The orb was deliberately **not** wrapped in `React.memo`. With the amplitude off
  the render path its parents no longer re-render sixty times a second, so a
  comparison would be paid for with nothing measurable to save. What it keeps
  instead is a shape that gives nobody a reason to re-render it: a state, a
  channel, and the session's own stable handler. Its only local state is the two
  media flags (reduced motion, tab visibility), which change when the OS setting
  or the tab does — not per frame.
- Both entry points unmount rather than hide while a session is live, so there is
  never a second (or third) orb animating off-screen.

Measured effect: **0 commits and 0.0 ms of render work across 30 audio frames**,
against 42 commits and 2339 ms before the channel existed.

## How the microphone and the AI were separated from the orb

The orb owns no lifecycle. It does not request a microphone, initialise the AI
client, fetch anything, or run a loop; it renders a state it is handed.

On the session side, the ordering is now: the tap changes the state **first**, then
the permission probe (the browser's dialog is the slow, human step), then the audio
meter, then the recogniser. The probe still gates the session — an unusable
microphone closes it and raises the existing notice rather than showing a listening
overlay over a dead mic — but it no longer gates what the user sees. A session
ended while the dialog is up (Escape, or the end control) can no longer open a
recogniser after the fact.

Neither the AI call nor the microphone is on the orb's path to the screen: the
shell renders the orb on its first commit (asserted), and the state change is a
local `useState` transition.

## Before and after

### React work while listening (same harness, same machine)

| | Commits / 30 audio frames | Render work | Startup commits |
|---|---|---|---|
| Before (recorded when the channel landed) | 42 | 2339 ms | — |
| **After (this run)** | **0** | **0.0 ms** | 6 |

The printed line from the run: `[mica render budget] 0 commits / 30 audio frames,
0.0ms render work, 6 startup commits`. The "before" number is the one the test
itself records from when the change landed; it can be re-measured by reverting the
channel — the harness is unchanged.

### Bytes before the first paint (three builds, same machine, two runs)

Measured with `scripts/perf/first-load.mjs` against `dist`: the pre-split shape with
the surfaces imported eagerly, the same shape as shipped after the split, and the
current build with the timing instrument in it:

| Build | First-load files | JS+CSS raw | JS+CSS gzip | Entry chunk raw / gzip |
|---|---|---|---|---|
| Surfaces eager (pre-split) | 5 | 1024.0 kB | 319.5 kB | 307.2 kB / 95.2 kB |
| Surfaces lazy (the animation revision, shipped) | 5 | 889.8 kB | 275.7 kB | 172.9 kB / 51.4 kB |
| **Surfaces lazy + the timing instrument (current)** | 5 | **893.9 kB** | **277.2 kB** | **177.0 kB / 52.9 kB** |

Against the pre-split build that is **−130.1 kB raw / −42.3 kB gzip** off the path,
all of it the entry chunk. The animation library the surfaces use is now its own
128.9 kB / 42.4 kB gzip chunk, and `index.html` does not reference it. Note that the
eager variant is a *lower bound* on the old cost: the orb itself imported
framer-motion too, which the current orb does not.

The **instrument costs 4.1 kB raw / 1.5 kB gzip** on the first-load path, which is
worth naming rather than rounding away: `useMica` imports the recorder module
statically, so the recorder and its formatting travel with the entry chunk on every
page. The readout itself does not — `MicaTimingsPanel` is a `lazy()` chunk, so a
session with `?micaTimings=1` off pays nothing for it, and the panel's own weight is
outside these five files. The two build rows were measured in different runs on the
same machine (the eager/lazy pair back to back in the animation revision, this row
in the timing revision), so read the 4.1 kB as this addition's size rather than as a
between-machine comparison.

### Other

- The orb is present on the shell's **first React commit**, before any provider
  call, permission prompt or network activity (asserted).
- Mobile: `npx tsc --noEmit` clean; 37 suites / **310 tests** pass, including the
  new geometry proofs for tablet, small Android and both iPhone insets.
- Web: `npx tsc --noEmit` clean, and the full web suite green (see "Verification"
  below). The Mica suites were 10 files / 65 tests at this revision; after the stage
  timings work they are **12 files / 102 tests**.

## Targets

| Target | Status |
|---|---|
| Orb appears with the first usable application render | Met — asserted on the first React commit, and the shell no longer pays for the assistant's UI |
| No layout shift when the orb appears | Met — fixed geometry from `MICA_GEOMETRY`, no animation of layout properties, and the pending surface reserves nothing new |
| State transitions begin immediately on the interaction | Met — the state change precedes the microphone probe, and a test holds the probe open to prove it |
| No duplicate animation loops or leaked listeners | Met — one surface at a time, CSS keyframes with no JavaScript loop to leak, subscription cleaned up on unmount and on reduced motion |
| No unnecessary API calls while idle | Met (by construction — the orb issues none; the surfaces are fetched on intent) |
| No material slowdown to scrolling, navigation or forms | Not measured on device; the mechanism is that no per-frame JavaScript remains on the orb's path (see below) |
| 60 fps on typical devices, ~16.7 ms frame work | Not measured on device |
| Reduced motion respected, with a meaningful accessible name and state | Met — both platforms; the orb is a labelled button, the state is announced through a live region, and reduced motion parks rather than slows |

## Measuring it on a device: the eight stage timings

Every number earlier in this document came from a harness. That is the right
instrument for "was the work removed" and the wrong one for "how long does this
make the carer wait" — and the gap recorded below, no microphone → speech → reply →
playback breakdown, is now closed by an instrument rather than an argument.
`apps/web/src/components/mica/mica.timings.ts` records when each stage actually
happened, `useMica` marks it, and the numbers are readable on the device you are
holding.

| Stage | The moment | Marked in |
| --- | --- | --- |
| `tap` | The orb was pressed — the origin of the turn | `startListening` |
| `listening` | The session is live and listening; the press has been acknowledged | the state entry for `listening` |
| `micReady` | A real microphone stream is open and feeding the orb | after the meter opens |
| `speechDone` | The recogniser returned a final transcript — the sentence is over | `rec.onend`, before dispatch |
| `replyStarted` | Mica began producing an answer | the `thinking` entry in each reply path |
| `firstToken` | The first reply content existed and was about to be spoken | `reply()` / `fail()` |
| `done` | The reply finished playing | the TTS completion path |
| `idle` | The session closed | the state entry for `idle` |

`firstToken` is not a token. `/ai/mica/ask` is a single request and response — no
`EventSource`, no `text/event-stream`, no `ReadableStream` in either app — so the
mark is the first moment reply content existed, which on this pipeline is when the
response arrived. If streaming is ever added the mark moves to the first delta and
every consumer keeps working.

### How to take the numbers

1. Open the app on the device — or in Chrome's device mode, which is better than
   nothing and worse than a phone — and add `?micaTimings=1` to the URL. The flag is
   stored, because Mica *navigates*: a query string would be lost the first time a
   reply opened a page, and a readout that disappears when the feature works is
   worse than no readout.
2. Tap the orb and speak. The panel sits top-left, deliberately outside Mica's own
   layering ladder (`MICA_Z.notice + 1`), so it stays legible while the overlay it is
   measuring is on screen. Eight rows fill in as the pipeline reaches them, and a
   stage that never fired reads `—` — that dash is the finding, not a zero.
3. Read the gaps and the spans under the rows: **tap → first token** (the number a
   user feels first), tap → done, tap → idle, speech done → reply, reply → first
   token. Each row carries its gap from the previous stage, so the panel answers
   *where* the wait was and not just how long it was.
4. `?micaTimings=0` removes it again, which is how you clear it on a phone without
   opening a console.

Without the panel, `window.__micaTimings` is installed always:

```js
__micaTimings.text()   // the session's eight stages, ready to paste into a report
__micaTimings.spans()  // the named spans
__micaTimings.table()  // every turn held, one row each
__micaTimings.reset()
```

Nothing leaves the device: there is no analytics endpoint, no beacon and no `fetch`
in the timing module. This pipeline carries health data, and a timing module that
phoned home would be a new processor in that path for no benefit. The handle
exposes timings only — no transcript, no reply, no identifiers — which is why it can
be left on permanently: the tap that felt slow is not one you think to switch
instrumentation on for in advance.

### Why the reading is a session, not the latest turn

A reply reopens the microphone, so a finished turn is followed by a turn with no tap
in it. Per-turn numbers are correct and are kept (`turns()`, `console.table`), but
the readout reports the **session**: the turn the tap opened, with the stages of the
turns that followed merged onto its origin. Without that, the number the carer had
just read would be replaced by dashes a beat after the reply finished. A stage keeps
its *first* occurrence, so `tap → first token` cannot drift into "tap to the latest
reply"; `idle` is the one exception, because the session closes once and at the end.

### Reading it

There is no target in this document to compare the numbers against, and that is
intentional — the point of the readout is that the next conversation about Mica
feeling slow can start from a measurement instead of an opinion. Two things to watch
when someone takes the reading: `tap → mic-ready` is where a locked-down Android
shows up (the permission dialog plus `getUserMedia`), and `speech-done → reply
started` separates the turn dispatcher's own cost from the speech API, which is the
difference between looking at the routing table and looking at the recogniser.

## What could not be verified

Stated plainly, because none of it is claimed above:

- **No frame-rate measurement on real hardware.** There is no device or emulator
  in this environment. The claim is about *mechanism*: no JavaScript per frame, no
  blur or animated shadow, transforms and opacity only, promoted layers only. That
  is the shape that removes the stutter, but the frames were not counted on a
  low-powered Android or an older iPhone.
- **No production-browser first-paint measurement.** The authenticated shell needs
  the API, Postgres and a session, so the orb's independence from network activity
  is asserted in the test harness rather than observed in Chromium with a
  performance trace. The bundle numbers above are measured from the real build.
- **No device measurement of the voice pipeline — its instrument now exists.**
  Microphone, speech, reply and playback timings are recorded, surfaced on the device
  and covered end to end on a controlled clock (see *Measuring it on a device*). What
  is still missing is a person with a phone and a locked-down mobile browser to run
  it. So no claim in this document rests on a latency number taken from real
  hardware; those stages do at least fail independently, which they did not before
  (a dead mic is a notice, a failed reply is the error state, and a slow reply no
  longer leaves the orb idle).
- **Mobile reduce-motion and backgrounding are wired and unit-tested, not
  device-verified.** `AppState` and `AccessibilityInfo` are mocked under jest.
- **Text-to-speech amplitude on mobile.** The mobile orb cannot meter TTS audio, so
  the responding state uses the timed pulse the brief allows rather than a real
  level. The web orb does use the real TTS envelope.
- **The first tap of a session on a cold cache still fetches the surfaces.** It is
  ~2 kB gzip, it is prefetched on pointer-down/hover/focus, and the pending surface
  covers the gap — but it is a fetch, and a user who taps with no pointer history
  and no cache pays it.
- **The copy shown during the permission prompt says "Mica is listening…".** That
  is the pending state the brief sanctions, but it is a slight overstatement while
  the browser dialog is unanswered.

## Verification

### As of the timing instrument (this revision)

- `apps/web`: `npx tsc --noEmit` clean; `npx eslint . --ext ts,tsx
  --report-unused-disable-directives --max-warnings 0` clean (whole app, exit 0);
  full suite **49 files / 403 tests, all passing**. The `Layout.test.tsx` flake
  recorded in the previous revision of this section did not recur in this run.
- The Mica files specifically: **12 files, 102 tests green** — including the two new
  ones, `mica.timings.test.ts` (the recorder: absent-not-zero, turn boundaries, the
  ring buffer, the session merge) and `mica.timings.e2e.test.tsx` (a real turn
  through the provider on a frozen clock, asserting all eight stages, their offsets,
  the gaps, the spans, the continuation and the panel's rendering of them).
- Design guards, since the readout is new UI: `npm run design:check` (the palette and
  the route tracker match; the `DESIGN.md` component inventory regenerated to 52
  shared components), `npm run design:lint` (0 off-palette hex occurrences, 0
  baselined), `npm run design:test` (23 pass, 0 fail).
- This revision touched `apps/web` and documentation only.

### As of the animation and render work (the previous revision)

- `apps/api`: `npx tsc --noEmit` clean (that work touched no API code).
- `apps/mobile`: `npx tsc --noEmit` clean; `npx jest` 37 suites / 310 tests green.

## Re-running the measurements

```bash
# React work per audio frame while the microphone is open (prints its own budget)
cd apps/web && npx vitest run src/components/mica/mica.renderBudget.test.tsx

# Bytes on the first-load path, from a real build
cd apps/web && npx vite build
node scripts/perf/first-load.mjs apps/web/dist --list

# The eight stage timings: the recorder's contract, then a real turn end to end
cd apps/web && npx vitest run src/components/mica/mica.timings.test.ts src/components/mica/mica.timings.e2e.test.tsx
```

The last pair proves the instrument against a frozen clock; it does not take the
reading. For that: `?micaTimings=1` on the device, tap the orb, speak, and read the
panel — see *Measuring it on a device*.
