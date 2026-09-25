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

Suggested shot list, in the order a reviewer reads them:

1. Today / visit list — the first screen a care worker sees
2. Visit in progress with check-in, showing the location capture
3. Client detail — care notes, body map, medication
4. Report an incident — the safeguarding path
5. Chat — team communication
6. Offline sync rail — the differentiator, and the hardest to screenshot because
   it needs airplane mode

Screenshots 1–5 can be captured from a simulator; **6 needs a real device** to
toggle connectivity.

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
