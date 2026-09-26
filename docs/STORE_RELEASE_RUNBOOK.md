# Store release runbook — Meticle Care mobile

The remaining work is all credential- or device-dependent. Nothing here can be
done from a laptop without an Expo account, a Google Play developer account and
an Apple Developer account.

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

Minimum requirements:

| Store | Requirement |
| --- | --- |
| Google Play | At least 2 phone screenshots; 16:9 or 9:16, 320–3840 px on the long edge. Optional 7" and 10" tablet sets. |
| Apple | 6.9" and 6.5" iPhone sets. Only one size is mandatory. 1290×2796 (6.7"/6.9") and 1242×2688 or 1284×2778 (6.5") are accepted. |

Both also want a **feature graphic** (Play: 1024×500) and an **app icon**
already generated at 1024×1024.

### The six shots, and how to take them

The shot list, in the order a reviewer reads them:

1. Today / visit list — the first screen a care worker sees
2. Visit in progress with check-in, showing the location capture
3. Client detail — care notes, body map, medication
4. Report an incident — the safeguarding path
5. Chat — team communication
6. Offline sync rail — the differentiator

That list is written down once, in `apps/mobile/src/capture/shots.ts`, with the
line of store copy that goes under each image. Re-shooting after a rebuild does
not mean re-deciding what to photograph.

**Do them by hand if you have to — but the scripted route is one command and
gives you the same six images every time.**

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
it means some panel in one of the six images is empty, and the image still
looks plausible enough to publish. The fix is to add the missing fixture to
`src/capture/fixtures.ts` and re-run, not to upload and hope. The script cannot
check anything else — that is what the six-shot test suite cannot do for you.

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
- Whether the **ISO 27001** claim in the public privacy policy is accurate. If
  the hosting provider does not hold it, the published policy needs correcting
  before submission.

## 4. Not yet verified by anything

No build has been produced, no device has run this, and nothing has been
uploaded. Everything in the store configuration is verified statically
(`npx expo config --type public`, `npx expo-doctor@latest` at 21/21) and by
`tsc` plus the test suites. The first real `eas build` is still the thing that
will surface whatever is left.
