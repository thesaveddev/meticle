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

#### Known: the run is not yet reproducible on a slow machine

A full seven-shot set has been captured and passed Play's format checks, but
the images are not yet uploadable. On this machine the app takes long enough to
boot that the first three shots photograph one unrendered frame — the three
files come out byte-identical — and the fourth lands on a blank screen. The
format checker passes regardless, because a flat grey frame is a valid PNG at
1080x1920.

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

## 4. Not yet verified by anything

No build has been produced, no device has run this, and nothing has been
uploaded. Everything in the store configuration is verified statically
(`npx expo config --type public`, `npx expo-doctor@latest` at 21/21) and by
`tsc` plus the test suites. The first real `eas build` is still the thing that
will surface whatever is left.
