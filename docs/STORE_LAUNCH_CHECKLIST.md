# Store launch checklist — Meticle Care mobile

Status as of the config-only remediation pass. Everything in "Done" is committed to
`apps/mobile/app.json` and `package.json` and verified by `npx expo config --type public`
plus `npx expo-doctor@latest` (21/21).

## Done (config-only, no credentials needed)

| Item | Where |
| --- | --- |
| App icon wired (`assets/icon.png`, 1024px, INK `#1A2332` + white M) | `app.json` → `icon` |
| Android adaptive icon + monochrome layer | `app.json` → `android.adaptiveIcon` |
| Splash screen, light + dark variants | `expo-splash-screen` plugin |
| Notification icon (was `icon: null`, which resolved to `icon: {}`) | `expo-notifications` plugin |
| `android.versionCode: 1` / `ios.buildNumber: "1"` — required for a second upload | `app.json` |
| Store `description` (was resolving as `undefined`) | `app.json` |
| iOS camera / photo library / Face ID permission strings (were Expo defaults) | `expo-image-picker`, `expo-local-authentication` plugins |
| Removed bogus `NSUserNotificationsUsageDescription` — not a real iOS key | `app.json` |
| `ITSAppUsesNonExemptEncryption: false` — TLS only, standard exemption | `ios.infoPlist` |
| `android.allowBackup: false` — health app, no cloud backup of local state | `app.json` |
| Blocked deprecated `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` | `android.blockedPermissions` |
| `expo-doctor` 21/21 (was 3 failures) | — |
| TypeScript 5.9 → 6.0.3 and 8 Expo packages bumped to SDK 57 patches | `package.json` |
| Dropped `@types/react-native` from devDependencies (RN ships its own) | `package.json` |
| Added `expo-splash-screen` dependency — the plugin could not resolve without it | `package.json` |

### Two audit findings that did not need fixing

- **`expo-dev-client` in `dependencies`** — flagged as leaking `SYSTEM_ALERT_WINDOW` into the
  release manifest. In SDK 57 its `android/src/main/AndroidManifest.xml` is empty and its merged
  manifest declares zero permissions. The dependency is what makes `developmentClient: true` work
  for the `development` EAS profile, so it stays put.
- **Android release signing using `signingConfigs.debug`** — real, but not a repo problem.
  `apps/mobile/android/` is gitignored CNG output; EAS regenerates `build.gradle` per build and
  signs with a managed keystore. The debug block only affects a local
  `expo run:android --variant release`, which is not a store path.

### One thing worth knowing about the tsconfig change

TypeScript 6 stopped auto-including every package under `node_modules/@types`, so the jest
globals disappeared from 754 call sites across the test suite. `tsconfig.json` now names them
explicitly via `"types": ["jest", "node"]`, and `@types/node` is a real devDependency rather than
relying on root hoisting. Without this the TypeScript bump would have looked like it broke 15
test files.

## Blocked — needs credentials or a product decision

- **Play upload key + EAS managed keystore.** Generate in the EAS dashboard, then confirm the
  first `app-bundle` is signed with it. Play will not accept a second upload signed with a
  different key than the first.
- **Play App Signing / Data safety form.** Requires declaring that the app handles health and
  location data, and stating the encryption and deletion paths. Product decision, not code.
- **Apple App Privacy questionnaire.** Same shape; `ITSAppUsesNonExemptEncryption: false` is now
  declared in the binary, but the questionnaire is answered in App Store Connect.
- **Store listing media.** No screenshots, no feature graphic. Apple requires 6.9" and 6.5"
  iPhone screenshots; Google requires at least 2 phone screenshots. These have to be captured
  from real builds — nothing can be generated ahead of that.
- **Account deletion is implemented and the Play Data safety form can now be answered honestly.**
  Settings → Delete my account calls `POST /staff/self-deactivate`, then clears the session.

## Unverified

Nothing here has been built, run on a device, or uploaded. All of the above is static config
plus `tsc` and the test suites (mobile 103/15 suites, api 21 targeted integration tests). The
first real `eas build --profile production` is still the thing that will surface anything left.
