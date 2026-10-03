# Store launch checklist — Meticle Care mobile

Status after the config-only remediation pass, the real brand asset swap, the
account-deletion fix, and the first internal-track draft. Detail lives in
`docs/STORE_RELEASE_RUNBOOK.md`, `docs/STORE_PRIVACY_ANSWERS.md`, and
`docs/PLAY_REVIEWER_GUIDE.md`.

One correction worth stating up front: an earlier pass of this list reported a
`BILLING_RESTRICTED` blocker for the Play reviewer. It was derived from the
**local dev database** and does not apply to the production organisation the
reviewer signs in to. Nothing about billing is blocked.

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
- **`SYSTEM_ALERT_WINDOW` is blocked in Expo's Android config.** Added
  `android.permission.SYSTEM_ALERT_WINDOW` to `android.blockedPermissions` in
  `apps/mobile/app.json`. Fresh prebuild output omits it from the app manifest
  and emits the Android manifest-merger remove directive. The SOS button is an
  in-app React Native control; it uses the regular alert/action sheet and phone
  dialler, and has no overlay API dependency. Confirm the permission is absent
  from the merged release manifest on the next Android release build before
  upload (not verifiable on this machine because Java is unavailable).
- **Play reviewer access is separate from permissions.** Add the test username
  and password in Play Console's **App access** section so reviewers can reach
  gated content. Do not store the password in this repository. Since
  `SYSTEM_ALERT_WINDOW` is blocked, no justification for that permission should
  be needed if it is absent from the final app bundle.

## Verified live against the Play API — 2 October 2026

These were checked with the service account against the real
`androidpublisher` API rather than assumed. No release was published.

| Check | Result |
| --- | --- |
| Service account authenticates | OK — `meticlecare-play@meticlecare.iam.gserviceaccount.com` |
| Google Play Android Developer API enabled | Yes — an edit was created and deleted successfully |
| App `com.meticlecare.mobile` exists in Play Console | Yes — `edits.insert` returned an edit id |
| Any release in any track | **None.** `internal`, `alpha`, `beta` and `production` are all empty |
| Any APK or AAB ever uploaded | **None** — both artifact lists are empty |
| Store listing | Only `defaultLanguage: en-GB`; no title, description, or screenshots set |
| `versionCode 1` already consumed | **No** — nothing has been uploaded, so `1` is still free |

### The existing AAB must not be submitted

The `production` profile already had a finished store build
(`0759fd18-27de-40e7-9be4-62b4f84ce5c3`, 26 September 2026). Its
`base/manifest/AndroidManifest.xml` was extracted and decoded: it **contains
`android.permission.SYSTEM_ALERT_WINDOW`**, which is the permission
`android.blockedPermissions` now removes. `aapt2` cannot dump an AAB and
`strings` is not on PATH on this machine, so the protobuf manifest was decoded
directly; both SYSTEM_ALERT_WINDOW and the package name are present, and
`RECORD_AUDIO`, the external-storage permissions, `MANAGE_EXTERNAL_STORAGE`
and `QUERY_ALL_PACKAGES` are absent.

That build predates the `app.json` fix and is not an ancestor of `master`, so
it cannot be patched. It was **not** submitted: Play requires strictly
increasing `versionCode`, and uploading it would permanently burn `1` on a
bundle that contradicts the app's own policy declaration. A fresh build was
started instead.

## Still blocking a real production release

| Blocker | Why it matters | Owner |
| --- | --- | --- |
| ~~No store screenshots~~ | **Tooling ready 2 October 2026**, but nothing captured yet. Seven-shot scripted capture exists and now includes the login screen, and each file is checked against Play's format rules (24-bit PNG, no alpha — which `adb screencap` gets wrong by default). **Not verified end to end: this machine has no emulator package and no AVD.** | Needs an emulator |
| ~~Store icon is 1024×1024~~ | **Solved 3 October 2026.** A compliant 512×512 32-bit icon and a 1024×500 feature graphic now exist, generated by `brand/build-from-supplied.mjs` from the supplied brand kit and validated by `npm run brand:check`. They are installed at `store-assets/play-icon-512.png` and `store-assets/play-feature-graphic-1024x500.png`, wired into `app.json`, and **still need uploading to Play by hand.** See `brand/README.md`. |
| ~~No feature graphic~~ | **Solved** — same as above |
| Data safety form | Must match the privacy answers in `docs/STORE_PRIVACY_ANSWERS.md` | You, in Play Console |
| Content rating questionnaire | Unanswered; blocks production | You, in Play Console |
| ~~Play reviewer hits `BILLING_RESTRICTED`~~ | **Never existed. Corrected 2 October 2026.** The expired-trial evidence came from the *local* dev database (`localhost:5432/meticle`) and was mistaken for production; the app calls `https://meticlecare.com/api` (`apps/mobile/src/services/api.ts`), whose organisation is active. There is no billing blocker, nothing to seed and nothing to arm. Migration `140_time_boxed_review_access` exists but no row holds a grant, so it is inert. | Nothing |
| No upload-key backup | EAS holds the keystore ("Build Credentials 1LdWOI-6iH"); losing Expo access means losing the key | You |

## First draft is uploaded — 2 October 2026

Build `2668b5cd-5e38-47cb-aa0f-f551ea9413db` was submitted and confirmed
through the Play API, not just by EAS's own success message:

```
tracks/internal -> { "name": "0.1.0", "versionCodes": ["1"], "status": "draft" }
bundles          -> versionCode 1, sha256 40e9eb8e0f98538a71e20e68649c4c4157e493b58e103c7a99b68deb477d9e4c
```

The sha256 matches the downloaded AAB byte for byte, so the upload is verified
end to end. `alpha`, `beta` and `production` remain empty and nothing is
reviewable or installable.

The uploaded manifest was extracted and decoded before submission:
`SYSTEM_ALERT_WINDOW`, `RECORD_AUDIO`, the external-storage permissions,
`MANAGE_EXTERNAL_STORAGE` and `QUERY_ALL_PACKAGES` are all **absent**. Package
is `com.meticlecare.mobile`.

The service account key used for the upload was deleted from the working tree
immediately afterwards, as agreed. **Rotate it in Google Cloud** before the next
publish — the key that just authorised this upload is no longer needed and
should not be reused.

## The three audit findings that did **not** need fixing

- **`expo-dev-client` in `dependencies`** — previously flagged as leaking
  `SYSTEM_ALERT_WINDOW`. In SDK 57 its own Android manifest is empty; the
  permission came from Expo's generated app manifest and is now blocked there.
  It is also what makes `developmentClient: true` work, so it stays.
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

- **Google Play reviewer access is your own account, and that is deliberate.**
  `itsopeyemi@gmail.com` is the existing ORG_ADMIN; its role is preserved. The
  production organisation is active and holds only dummy data, so handing your
  own login to Play reviewers exposes nothing. Nothing needs seeding and no
  billing change is required — an earlier version of this list claimed
  otherwise on the strength of a local dev database, which was simply the wrong
  tenant. Revisit when the organisation holds real records. See
  `docs/PLAY_REVIEWER_GUIDE.md`; the password belongs only in Play Console's
  secure App access form.
- **Play upload key + EAS managed keystore.** Exact commands in the runbook. The
  one trap: the first bundle you upload fixes the upload key forever.
- **Play Data safety and Apple App Privacy forms.** The draft answers are in
  `docs/STORE_PRIVACY_ANSWERS.md`. In Play Console, open the app and go to
  **Policy and programs → App content → Data safety**. They need your sign-off,
  not more engineering.
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
