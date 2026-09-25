# Store launch checklist — Meticle Care mobile

Status after the config-only remediation pass, the real brand asset swap, and
the account-deletion fix. Detail lives in `docs/STORE_RELEASE_RUNBOOK.md` and
`docs/STORE_PRIVACY_ANSWERS.md`.

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

## The three audit findings that did **not** need fixing

- **`expo-dev-client` in `dependencies`** — flagged as leaking
  `SYSTEM_ALERT_WINDOW`. In SDK 57 its `android/src/main/AndroidManifest.xml` is
  empty and its merged manifest declares zero permissions. It is also what makes
  `developmentClient: true` work, so it stays.
- **Android release signing on `signingConfigs.debug`** — real in the local
  CNG output, but `android/` is gitignored and EAS signs with a managed
  keystore. Not a repo problem.
- **Store screenshots** — still not done, but they cannot be faked. See the
  runbook.

## Two real bugs found and fixed while verifying

- **`self-deactivate` did not delete anything.** It set
  `status = 'deactivated'` and stopped there, leaving email, date of birth,
  phone, address, photo, emergency contacts, live MFA secrets and outstanding
  reset tokens in the database. Now erased, with the professional name kept on
  purpose so care records stay attributable. I originally reported this as
  "genuinely implemented" — it was not.
- **Two homecare suites failed depending on the hour they ran.** Both scheduled a
  visit relative to "now" and derived the day by slicing a UTC timestamp, while
  the endpoints bound the period with bare `::date` casts resolved in the
  session timezone (`Europe/London`, where a day ends at 23:00Z). Between 22:00
  and 24:00 UTC the visit fell outside the window of its own date. Caught only
  because the suite happened to run late in the evening.

## Still blocked — needs credentials, a device, or a legal decision

- **Play upload key + EAS managed keystore.** Exact commands in the runbook. The
  one trap: the first bundle you upload fixes the upload key forever.
- **Play Data safety and Apple App Privacy forms.** Answers drafted from the
  code in `docs/STORE_PRIVACY_ANSWERS.md`. They need your sign-off, not more
  engineering.
- **Retention lawful basis** for keeping a worker's professional name after
  deletion. A DPO or legal adviser should confirm the position.
- **ISO 27001 claim** in the public privacy policy. If the host does not hold
  certification, that published claim needs correcting before submission.
- **Store listing screenshots** for both platforms. Real device captures.

## Unverified

Nothing has been built, run on a device, or uploaded. All of the above is static
config plus `tsc` and the test suites: API 650 tests across 92 files, mobile 103
across 15, web typecheck clean.
