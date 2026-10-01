# Store launch checklist — Meticle Care mobile

Status after the config-only remediation pass, the real brand asset swap, and
the account-deletion fix. Detail lives in `docs/STORE_RELEASE_RUNBOOK.md` and
`docs/STORE_PRIVACY_ANSWERS.md`.

The store work is separate from the email-domain work in
`docs/EMAIL_SECURITY_RUNBOOK.md`, which has its own open decision.

## Done — verified, no credentials needed

| Item | Where |
| --- | --- |
| App icon, Android adaptive icon + monochrome layer, splash (light + dark), notification icon | `apps/mobile/assets/` |
| `android.versionCode: 1` / `ios.buildNumber: "1"` | `app.json` |
| Store `description` | `app.json` |
| iOS camera / photo library / Face ID permission strings (were Expo defaults) | `expo-image-picker`, `expo-local-authentication` plugins |
| Removed bogus `NSUserNotificationsUsageDescription` | `app.json` |
| `ITSAppUsesNonExemptEncryption: false` | `ios.infoPlist` |
| `android.allowBackup: false` | `app.json` |
| Blocked deprecated `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` | `android.blockedPermissions` |
| `expo-doctor` 21/21 (was 3 failures) | — |
| TypeScript 5.9 → 6.0.3, 8 Expo packages to SDK 57 patches | `package.json` |
| Dropped `@types/react-native`, added `expo-splash-screen` and `@types/node` | `package.json` |
| `npx expo config --type public` resolves clean, no `undefined` | — |
| EAS builds now fail on a typecheck or test failure | `eas-build-post-install` → `npm run verify` |
| Account deletion erases personal data | `staff.controller.ts` + 6 integration tests |

## Verified against Google Play policy — 1 October 2026

The target API level is the requirement that most often blocks a first
submission, so it was checked against the primary source rather than assumed.

- **Target API level: 36 — compliant, no work needed.** From 31 August 2026,
  new apps and updates must target Android 16 (API level 36) or higher
  (developer.android.com/google/play/requirements/target-sdk). An extension to
  1 November 2026 exists, but it is not needed here. The value was read out of
  Expo's own gradle plugin source
  (`ExpoRootProjectPlugin.kt`, `versionCatalogs.getVersionOrDefault("targetSdk",
  "35")`, overridable by the `android.targetSdkVersion` gradle property) and
  confirmed against the resolved manifest of a real build already on this
  machine: `android:targetSdkVersion="36"`, `android:minSdkVersion="24"`.
  Expo SDK 57 ships API 36 by default, which is why this needed nothing.
- **`SYSTEM_ALERT_WINDOW` ships in the release manifest.** It is written by
  Expo's prebuild template directly into the app's own
  `android/app/src/main/AndroidManifest.xml`, not merged in from a library — the
  manifest merger blame report attributes it to that file, and the only
  `SYSTEM_ALERT_WINDOW` anywhere in the dependency tree is React Native's own
  *debug* manifest. It is not in `app.json`, so it was never a deliberate
  choice. Play treats permissions that access sensitive information as
  declaration-gated: a permission that is not needed for a core functionality
  promoted in the store listing is grounds for rejection. A care-visiting app
  cannot justify drawing over other apps. **Expect to declare or remove it.**
- **The declaration form also demands a video and sign-in credentials.** Play
  evaluates permission requests during release and may require the Permissions
  Declaration Form, which needs a written core-functionality justification, a
  video walkthrough, and — because Meticle Care has no public content — a
  **test username and password** for a real organisation and staff account.
  Only accounts created specifically for review should be supplied, never a
  production user's.

## The three audit findings that did **not** need fixing

- **`expo-dev-client` in `dependencies`** — flagged as leaking
  `SYSTEM_ALERT_WINDOW`. In SDK 57 its `android/src/main/AndroidManifest.xml` is
  empty and its merged manifest declares zero permissions. It is also what makes
  `developmentClient: true` work, so it stays.
- **Android release signing on `signingConfigs.debug`** — real in the local
  CNG output, but `android/` is gitignored and EAS signs with a managed
  keystore. Not a repo problem.
- **Store screenshots** — the six planned images are now scripted
  (`apps/mobile/src/capture`, `apps/mobile/scripts/capture-store-screenshots.mjs`).
  The app serves fixture data, raises no prompts, walks the six screens in order
  and announces each one; the host script takes the picture. **They have not
  been captured yet** — that needs a machine with a booted simulator or a device.
  The whole path is inert in a release build: `metro.config.js` resolves every
  module under `src/capture` to an inert stub unless `EXPO_PUBLIC_CAPTURE_MODE=1`
  is set, so the invented care records are never bundled at all. That matters
  because the `__DEV__` gate alone did not achieve it — the first production AAB
  shipped a client called Eileen with a care plan and medication list, present
  but unreachable. `npm run verify:no-fixtures` bundles the app and fails if any
  of it returns; it runs in CI. See the runbook.

## Three real bugs found and fixed while verifying

- **`self-deactivate` did not delete anything.** It set
  `status = 'deactivated'` and stopped there, leaving email, date of birth,
  phone, address, photo, emergency contacts, live MFA secrets and outstanding
  reset tokens in the database. Now erased, with the professional name kept on
  purpose so care records stay attributable. I originally reported this as
  "genuinely implemented" — it was not.
- **The API suite failed for an hour every evening.** Four homecare tests
  scheduled a record relative to "now" and derived the query day by slicing its
  UTC timestamp, while the endpoints bound the period with bare `::date` casts
  resolved in the session timezone (`Europe/London`, where a day ends at 23:00Z).
  After 22:40 UTC a visit twenty minutes out fell outside the window of its own
  date. It presented as a different unrelated module failing on each run.
- **The web "Add availability" button did nothing useful for anyone.** Tab
  panels were pinned to fixed indices while the tabs themselves were
  conditionally rendered on role, so they drifted. Managers landed on the
  Weekly summary; carers got a blank panel. Care workers could not add their
  own availability window at all.

## Still blocked — needs credentials, a device, or a legal decision

- **A Google Play review test account, with written access instructions.** Meticle
  Care requires sign-in, so Play's review of the permissions declaration and of
  the store listing needs working credentials for a seeded organisation and staff
  user. Play's own guidance is explicit that only dedicated test credentials
  should be given. Nothing in the repo can stand in for this.
- **`SYSTEM_ALERT_WINDOW` in the release manifest.** See above. Either it gets a
  defensible core-functionality justification, or it gets removed from the
  generated manifest before the first upload. It is currently in neither state.

- **Play upload key + EAS managed keystore.** Exact commands in the runbook. The
  one trap: the first bundle you upload fixes the upload key forever.
- **Play Data safety and Apple App Privacy forms.** Answers drafted from the
  code in `docs/STORE_PRIVACY_ANSWERS.md`. They need your sign-off, not more
  engineering.
- **Retention lawful basis** for keeping a worker's professional name after
  deletion. A DPO or legal adviser should confirm the position. The public
  deletion page now states what is kept and why, so this position is published
  and should be the one that has been checked.
- **ISO 27001 claim** in the public privacy policy. If the host does not hold
  certification, that published claim needs correcting before submission.
- **Store listing screenshots** for both platforms. Scripted and now proven not
  to leak into a store build, but the capture still needs a machine with a
  booted simulator or a device, and nobody has run one. This is the only gap
  that is a hardware constraint rather than a missing decision.

## Closed since the last pass

- **Account-deletion web URL.** Play and Apple both want a public URL for
  requesting deletion alongside the in-app path. `/delete-account` now exists,
  is linked in the sitemap alongside the other legal pages, and describes the
  in-app flow in `Settings → ACCOUNT → Delete my account` accurately. It states
  plainly that a care provider's records are retained, because that is what the
  app actually does.
- **Store version bumping.** `cli.appVersionSource` is now `"local"`, so
  `app.json` is the single source of truth and the EAS warning is gone.
  `npm run bump:version` moves `ios.buildNumber` and `android.versionCode`
  together — the two are separate keys and a bump that moves one and not the
  other is rejected by the store at upload time, after the review queue.
  `storeVersion.test.ts` asserts they stay in step, and fails on a half-bump.

## Unverified

Nothing has been built, run on a device, or uploaded. All of the above is static
config plus `tsc` and the test suites: API 650 tests across 92 files, mobile 103
across 15, web typecheck clean.
