# Google Play reviewer guide — Meticle Care

## Sign in

Use the reviewer credentials entered in Google Play Console's **App access** section:

- Account: `itsopeyemi@gmail.com`

The account is an **ORG_ADMIN** (the manager experience with additional permissions), rather than a MANAGER account. Its role is preserved. The password is intentionally not stored in this repository; provide it only through Play Console's secure reviewer-access fields.

### There is no billing blocker, and there never was

An earlier version of this guide claimed the organisation's trial had expired and that the reviewer would hit `403 BILLING_RESTRICTED` on every route. **That was wrong, and it came from reading the wrong database.**

The mobile app calls `https://meticlecare.com/api` — production. The expired-trial evidence came from `localhost:5432/meticle`, a local development database whose `Clean Care Ltd` fixture row is not the tenant the reviewer signs in to. A local test artefact was presented as a production fact.

The real production organisation is active and works normally, so **no billing change, no review grant and no seed run are required**. Nothing needs arming.

### Your own credentials go to Google

The usual reason for a separate reviewer login is that Play reviewers are Google staff or an automated service, and handing them your own account pointed at a live tenant exposes real care records. **That concern does not apply here**: this organisation holds only dummy data, and it has been checked.

So the reviewer account is `itsopeyemi@gmail.com`, the same one you use. That is a deliberate decision, recorded here so nobody "fixes" it later by generating a second account.

**Revisit this the moment the organisation holds real data.** A real service user record, a health note or a safeguarding incident would change the answer, and the fix at that point is a separate throwaway login rather than a billing change.

### Migration 140 is present but idle

`140_time_boxed_review_access` adds a time-boxed, opt-in override of the subscription gate. It was built while the local database was mistaken for production. It is **inert**: no row holds a grant, so it changes nothing for anyone, and it needs no action. It is kept only because it is already applied and tested; see `review-access-column-guard.integration.test.ts`.

## Suggested review path

1. Sign in to the Meticle Care mobile app. The ORG_ADMIN account opens the manager view, with **Team**, **Clients**, **Visits**, **Chat** and **Settings** tabs.
2. Open **Clients** to see the synthetic client list. Select a client to inspect their record and care information.
3. Open **Visits** and choose the **Active** filter to find the sample visit marked **checked in / active**. Open it to inspect the in-progress visit. The other sample visits show completed and scheduled states.
4. Use **Chat** to inspect staff communication, and **Settings** to review account settings.

Please avoid submitting visit check-out, incident, or care-note actions during review; these change the shared sample data. Location prompts depend on the organisation's configured location policy and the review device's permissions. The sample checked-in visit can be inspected without completing it.
