# Store release runbook — Meticle Care mobile

The remaining work is all credential- or device-dependent. Nothing here can be
done from a laptop without an Expo account, a Google Play developer account and
an Apple Developer account. Play reviewer access instructions are in
`docs/PLAY_REVIEWER_GUIDE.md`; enter the password only in Play Console's secure
App access fields, never in the repository. The reviewer account is
`itsopeyemi@gmail.com`, the existing ORG_ADMIN, with its role preserved. The
production organisation is active and holds only dummy data, so no separate
login is needed and no billing change is required before testing reviewer
navigation. An earlier version of this runbook claimed the trial had expired
and the billing middleware would block app data; that came from reading the
*local* dev database, which is not the tenant the reviewer signs in to, and it
was wrong. See `docs/PLAY_REVIEWER_GUIDE.md`.

## 1. Android signing

EAS manages the keystore; there is nothing to add to the repository. `android/`
is gitignored CNG output, so the `signingConfigs.debug` line visible in a local
`build.gradle` never reaches a store build — EAS regenerates it and signs with a
managed keystore.

On the first production build EAS will offer to generate the keystore:

```bash
cd apps/mobile
npx eas-cli@latest credentials -p android
```

Choose **Android keystore** → **Generate new**. EAS stores it encrypted; you
never handle the `.keystore` file. Confirm afterwards that the credentials
resolve:

```bash
npx eas-cli@latest credentials -p android
```

### The Play upload key is a separate thing

Play App Signing wraps your upload key. You need **both**:

- the **upload key** — proves to Google that this upload came from you
- the **app signing key** — the key Play actually signs the distributed APK with

If you let EAS generate the keystore, EAS is the uploader and the upload key is
whatever EAS holds. The trap to avoid: **the first app-bundle you upload
fixes the upload key forever.** If you later switch signing (a new EAS project,
a migrated upload key), Play rejects the new upload as a signature mismatch and
you must ask Google to reset the upload key. So decide now, and if Play Console
already has an app for `com.meticlecare.mobile`, check which key it expects
before the first upload.

**Superseded on 2 October 2026:** that first upload has happened — a draft went to the internal track (`docs/STORE_LAUNCH_CHECKLIST.md`) — so the upload key is already fixed to whatever EAS signed that bundle with. The paragraph above is kept because it explains *why* the key is now unchangeable, but there is no longer a decision to make before an upload, and the bring-your-own-key path below is closed with it: signing a future bundle with a different keystore would be rejected as a signature mismatch, and the only way to change it is to ask Google to reset the upload key. What remains is the backup: see §4.

If you want to bring your own upload key instead:

```bash
keytool -genkeypair -v \
  -keystore meticle-upload.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias meticlecare
```

Then `npx eas-cli@latest credentials -p android` → **Android keystore** →
**Upload** and supply the path, passwords and alias. **Never commit the
`.jks` or its passwords.**

### First build

```bash
cd apps/mobile
npx eas-cli@latest build --profile production --platform android
npx eas-cli@latest build --profile production --platform ios
```

`eas-build-post-install` now runs `npm run verify` (typecheck + jest) before the
build proceeds, so a compile error or a failing test fails the build instead of
producing a signed artefact.

### Submission

```bash
npx eas-cli@latest submit --profile production --platform android
npx eas-cli@latest submit --profile production --platform ios
```

`eas.json` already has a `submit.production` profile for both platforms. For
Play, submit to the **internal** testing track first — it is reviewed in minutes
rather than days, and catches manifest problems before you burn the production
review queue.

## 2. Store listing screenshots

These must be captured from a real build on a real device. There is no way to
generate them convincingly, and reviewers reject obviously composited images.

Minimum requirements, checked against Google Play Console Help on 1 Oct 2026
("Add preview assets to showcase your app", answer/9866151):

| Asset | Google Play requirement | Where we are |
| --- | --- | --- |
| App icon (store listing) | **512×512**, 32-bit PNG with alpha, max 1024 KB | `apps/mobile/assets/icon.png` is 1024×1024 at 766 KB. Wrong size for this slot — it needs a 512×512 export. The oversized original is still the right source. |
| Short description | 80 characters | Written in `app.json` |
| Feature graphic | **1024×500**, JPEG or 24-bit PNG, **no alpha channel** | Not made |
| Phone screenshots | **At least four**, minimum 1080 px; 9:16 portrait or 16:9 landscape (landscape minimum 1920×1080). **Up to eight.** | Seven scripted — see below |
| Tablet / Chromebook screenshots | At least four, 1080–7680 px, 16:9 or 9:16 | Optional, and would need a separate capture |

Two figures in this runbook were wrong until now and are corrected above. It
previously said "at least 2 phone screenshots" and that the app icon was "already
generated at 1024×1024". Google's page says four, and 512×512. Neither error
would have been caught until an upload was rejected.

The Apple figures below are unchanged from the previous version of this runbook and
were **not** re-verified in this pass — App Store Connect does not publish an
equivalent minimum worth citing without checking it directly:

| Store | Requirement |
| --- | --- |
| Apple | 6.9" and 6.5" iPhone sets. Only one size is mandatory. 1290×2796 (6.7"/6.9") and 1242×2688 or 1284×2778 (6.5") are accepted. |

### The seven shots, and how to take them

The shot list, in the order a reviewer reads them:

1. Sign in — the first screen anyone meets
2. Today / visit list — the first screen a care worker sees
3. Visit in progress with check-in, showing the location capture
4. Client detail — care notes, body map, medication
5. Report an incident — the safeguarding path
6. Chat — team communication
7. Offline sync rail — the differentiator

That list is written down once, in `apps/mobile/src/capture/shots.ts`, with the
line of store copy that goes under each image. Re-shooting after a rebuild does
not mean re-deciding what to photograph.

**The login shot is the odd one out.** Capture mode signs the app in with
fixture data before anything else, which is what makes the other six
repeatable — and which also means `LoginScreen` is never on screen during a
tour. So the app announces that shot itself, during start-up, in the gap
before it signs in.

The consequence is that **the login shot only appears on a cold start.** A
reload from Metro keeps the session and the shot is silently skipped. Fully
quit the app before a run that needs all seven.

**Do them by hand if you have to — but the scripted route is one command and
gives you the same seven images every time.**

#### Verified Android setup (3 October 2026)

The emulator this needs is now installed and known to work. What was actually
run, so it does not have to be rediscovered:

```bash
# 1. SDK pieces (the machine had adb and platform-tools but no emulator)
sdkmanager --install "emulator" "system-images;android-34;google_apis;x86_64"

# 2. One AVD. **The screen must be 9:16.**
avdmanager create avd -n meticle-capture \
  -k "system-images;android-34;google_apis;x86_64" -d pixel_5

# 3. Resize it. The Pixel profile's default is 1080x2340, which is 2.17:1.
#    Play rejects anything beyond 2:1, so every screenshot would be refused.
sed -i 's/^hw.lcd.height=.*/hw.lcd.height=1920/' ~/.android/avd/meticle-capture.avd/config.ini

# 4. Boot headless
emulator -avd meticle-capture -no-window -no-audio -no-boot-anim \
         -no-snapshot -gpu swiftshader_indirect
```

**The emulator refuses to start unless roughly 2560 MB of Windows commit is
free**, and it computes that requirement itself — passing `-memory` or editing
`hw.ramSize` does not lower it. A Firefox window was enough to stop it on a
16 GB machine. Close something before trying.

The build that works is the **EAS `development` profile**, not a local Gradle
build: `assembleDebug` fails locally with 42 `ld.lld` errors in
`react-native-worklets` (`undefined symbol: std::__ndk1::...`, the C++ runtime
is never added to the link line), which the EAS toolchain does not reproduce.

```bash
cd apps/mobile
npx eas-cli build --platform android --profile development   # dev client, debuggable
adb install -r <the .apk>                                        # run-as needs debuggable
adb reverse tcp:8081 tcp:8081
EXPO_PUBLIC_CAPTURE_MODE=1 npx expo start --dev-client --port 8081
node scripts/capture-store-screenshots.mjs --platform android
```

Two things about this sequence that are not obvious:

- **Start the capture script before you cold-start the app.** `00-login` is
  announced once, during boot; if the watcher is not already polling, that shot
  is gone.
- **After `adb shell pm clear`, dismiss the dev-client's one-time "developer
  menu" intro** before capturing, or it sits across the bottom of all seven
  images. It only reappears after a data clear.

#### Measured: the captured set is one frame, seven times

An earlier version of this paragraph said the first three shots photograph one
unrendered frame and "the fourth lands on a blank screen". **That was wrong in
two directions and it was the more dangerous kind of wrong**, because it
described a set with three bad files and four usable ones. There are zero usable
ones.

Measured on the artefacts in `store-assets/screenshots/android/`: all seven
files are **byte-identical** — `sha256 427eeaa5…`, 143,366 bytes each,
1080×1920 — and the frame they share is a fully rendered **Today** screen with
fixture data ("Good morning, Amara", 25%, three actions waiting to sync, an
07:30 call). The tour rendered; the capture photographed the same moment seven
times.

Play's format rules pass on every file — which is why the format check alone
could never have caught this. What catches it is the duplicate-content check:

```
FAIL  1 group(s) of identical screenshot(s): 00-login.png = 01-today.png = … = 06-offline-sync.png.
      The app did not move between these shots, so the set does not show the app.

      NOT UPLOADABLE
```

`npm run store:verify-screenshots -- --platform android` exits **1** on this set.
The gate that does this was added on 4 October, one day *after* this capture.

**Re-checked against the files on disk on 16 October 2026:** `sha256sum` over the
seven PNGs returns one digest (`427eeaa5…`) seven times, and the gate still exits
**1** with the same message. This is the one P0 in the store path that needs no
console access and no Play credentials to close — a capture run and then opening
the seven images.

**So a green format check is not evidence the screenshots are good.** Open them.
The most likely fixes are to raise the per-shot dwell times in
`src/capture/shots.ts`, or to run the capture on a machine with more free memory
so the emulator boots faster.

#### Play's format rules, checked for you

Screenshots are a different asset from the icon: Play wants **24-bit PNG with
no alpha**, and `adb screencap` emits 32-bit RGBA. The capture script rewrites
each file and then checks every one against Play's published rules — 320–3840px
per side, aspect ratio within 2:1, under 8MB, 2–8 screenshots — and records the
result in `capture-manifest.json` under `playFormat`.

If a capture ever arrives with genuinely translucent pixels the script refuses
to flatten it rather than compositing the transparency onto black, which would
look subtly wrong in the listing and nobody would notice until it shipped.

#### How the scripted capture works

With `EXPO_PUBLIC_CAPTURE_MODE=1` in a development build, the app:

- serves fixture data instead of calling the API (`src/capture/fixtures.ts`) —
  the clients, visits, care record, medication, chat history and sync queue are
  all invented, so nothing real appears in a public listing;
- raises **no permission prompts**: no push, no location, no photo library, and
  no chat socket;
- signs itself in and loads the day through the ordinary boot path, then walks
  the six screens in order, writing `capture-step.json` in its own documents
  directory once each screen has settled.

`scripts/capture-store-screenshots.mjs` watches that file and takes the
photograph. There are no tap coordinates anywhere, so nothing breaks when a
layout moves.

The mode is gated twice, and both gates have to pass: `__DEV__` **and** the
environment variable. A release bundle cannot enter it whatever the environment
says — see `src/capture/mode.ts` and `mode.test.ts`.

#### Running it

Terminal one — start the app in capture mode:

```bash
cd apps/mobile
EXPO_PUBLIC_CAPTURE_MODE=1 npx expo start --dev-client --ios
```

Terminal two — take the pictures:

```bash
cd apps/mobile
npm run capture:ios        # or capture:android
```

Useful flags: `--dry-run` prints the plan and touches nothing (works with no
device attached), `--only 05-chat` recaptures one image, `--udid` picks a
specific simulator, and `--print-launch` prints the first command for you.

The script writes into `store-assets/screenshots/<platform>/` (gitignored),
alongside two files it generates for you:

- `capture-manifest.json` — what was captured, when, on what, and any endpoint
  the fixtures could not answer;
- `store-listing-copy.md` — the caption for each image in order, ready to paste.

**Check the images before uploading them.** The script reports endpoints the
fixtures do not answer, which is how a screen that rendered emptier than it
should have shows up. Treat a non-empty list as a blocker rather than a note:
it means some panel in one of the seven images is empty, and the image still
looks plausible enough to publish. The fix is to add the missing fixture to
`src/capture/fixtures.ts` and re-run, not to upload and hope. The script cannot
check anything else — that is what the seven-shot test suite cannot do for you.

#### What is deterministic, and what is not

Visit times are derived from the moment the app starts and snapped to the half
hour, because the Today screen decides "past / under way / next" against the
real clock. A hard-coded 09:00 visit would be under way at 09:00 and overdue at
15:00, so the set would break depending on when you ran it. The result is the
same timeline at any hour of any day: one finished call, one under way, the
next, and — when it is still the same calendar day — one after that. The
greeting ("Good morning" / "Good afternoon") still follows the real clock, which
is correct rather than a defect.

Two things are deliberately **not** simulated, because faking them would be a
composited image:

- shot 6 shows the sync rail with actions waiting, seeded from the app's own
  queue code. It does not toggle airplane mode. If you want the genuine article
  on a physical device, put the app in airplane mode before the tour reaches
  shot 6.
- shot 4 is a *partly written* incident form, not a submitted one. The
  submission path is not exercised, so nothing is posted.


## 3. Still requires a human decision

- Play **Data safety** form — answers drafted in `docs/STORE_PRIVACY_ANSWERS.md`
- Apple **App Privacy** label — same document
- The **retention lawful basis** for keeping a worker's professional name after
  account deletion. The engineering is in place; the policy position is a legal
  call and should be confirmed with a DPO or adviser.
- ~~Whether the **ISO 27001** claim is accurate.~~ **Resolved: removed.** Contabo
  publishes no certificate and does not claim to hold it, so the claim has been
  taken off the privacy policy and both marketing pages and replaced with
  controls that can be evidenced. Do not put it back without a certificate to cite.
- Whether the **"data stored in the United Kingdom"** claim is accurate *today*.
  Contabo has a UK region (Portsmouth, delivered with Aptum), but the current
  production host's location has not been confirmed. The claim is only true once
  the UK VPS is live — check it before the app store submission goes in.

## 4. What has and has not been verified by anything

This section said "no build has been produced, no device has run this, and
nothing has been uploaded". None of the three is true now: a store build was
produced on 26 September, the app has run on an emulator in capture mode, and a
draft went to Play's internal track on 2 October 2026. Corrected below against
the artefacts on disk and the Play API, because a reader who trusted the old
paragraph would think there was nothing to look at.

**Built and uploaded, confirmed through the Play API** rather than by EAS's own
success message (`docs/STORE_LAUNCH_CHECKLIST.md`):

```
tracks/internal -> { "name": "0.1.0", "versionCodes": ["1"], "status": "draft" }
bundles          -> versionCode 1, sha256 40e9eb8e0f98538a71e20e68649c4c4157e493b58e103c7a99b68deb477d9e4c
```

That is build `2668b5cd-5e38-47cb-aa0f-f551ea9413db`; the sha256 was checked
against the downloaded AAB byte for byte. Its manifest was decoded **before**
submission: `SYSTEM_ALERT_WINDOW`, `RECORD_AUDIO`, the external-storage
permissions, `MANAGE_EXTERNAL_STORAGE` and `QUERY_ALL_PACKAGES` are all absent.
`alpha`, `beta` and `production` remain empty, so the draft is not reviewable and
not installable, and `versionCode 1` is now spent.

**Verified statically, with no device and no credentials**: `npx expo config
--type public` resolves clean, `npx expo-doctor@latest` is 21/21, `tsc` and the
test suites are green, and `npm run verify:no-fixtures` bundles the app and fails
if any capture fixture returns.

**Run on a device exactly once, and never by a person.** §2's capture run
installed the 3 October development-profile APK over `adb`, booted the app in
capture mode and photographed seven screens. That is a real boot with real
rendering, and it is the only time this app has run anywhere. Nobody has used
it: no manual walk, no tap-through by a person, no physical phone, and iOS has
never run at all. That gap between "it boots" and "it works" is still the
largest one here.

**Two preview APKs exist on this machine**, in `store-assets/apk/`:
`meticle-care-preview-build1.apk` (26 September) and
`meticle-care-preview-20261003.apk` (3 October, `development` profile — the one
the capture run installed). Neither is a store artefact. The 26 September build
survives as an AAB as well (`0759fd18-27de-40e7-9be4-62b4f84ce5c3`, `production`
profile), whose manifest was decoded on 2 October: it carries
`android.permission.SYSTEM_ALERT_WINDOW`, the permission
`android.blockedPermissions` now removes, so it predates the `app.json` fix.
**Do not submit either artefact** — Play requires strictly increasing
`versionCode`, and uploading that one would burn `1` on a bundle that
contradicts our own policy declaration (`docs/STORE_LAUNCH_CHECKLIST.md`).

**Still verified by nothing at all:**

- **The store screenshots.** All seven are one rendered frame — §2 — and
  `npm run store:verify-screenshots -- --platform android` exits **1** on the
  set. A green format check passes every file, so the fix is one capture run on
  a machine with headroom **and then opening the images**.
- **iOS.** No build, no capture, no App Privacy label.
- **The Data safety form.** `store/data-safety/template.csv` is still absent, so
  the form cannot be generated (`npm run store:validate` says so). One download
  from Play Console unblocks it.
- **The content rating questionnaire**, the store categories and the contact
  details: console-only clicks nobody has done.

**The upload key is now fixed, and unbacked-up.** The 2 October draft was the
first bundle Play received for `com.meticlecare.mobile`, so whatever EAS signed
it with is now the upload key and cannot be chosen again — §1's "decide now"
decision has already been made by that upload. What is missing is the copy: EAS
holds the keystore ("Build Credentials 1LdWOI-6iH"), and losing access to the
Expo account means losing the only key Play will accept a future upload from.

**Anything that exists only on this machine.** `store-assets/` is gitignored,
so both preview APKs (86 MB each), the 512×512 Play icon, the feature graphic,
the Google Play badge and the seven screenshots exist on one developer's machine
and nowhere else — not in the repository, not in CI, and not in any backup the
repository can see. The two brand assets are at least reproducible:
`brand/build-from-supplied.mjs` regenerates them from the supplied brand kit and
`npm run brand:check` validates the output. The APKs and screenshots are not
reproducible from this checkout, because the emulator state and the capture run
that produced them are not recorded anywhere.
