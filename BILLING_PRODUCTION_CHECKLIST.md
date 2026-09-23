# Billing production checklist

## Commercial model and UK domiciliary market benchmark (reviewed September 2026)

MeticleCare's currently configured self-serve subscription catalogue is Starter at £99/month and Professional at £299/month. These are distinct from the per-client and per-carer values in `organizations.billing_config.domiciliary`, which are provider-side client billing/cost modelling settings, not MeticleCare subscription charges.

Public competitor references reviewed:

- [CareLineLive pricing](https://carelinelive.com/pricing/): states a £120/month minimum plus VAT; published standard prices are £8.10/carer/month for eRoster, £19.70 for BYOD and £45 for managed handsets, excluding VAT. Office users are not charged.
- [Birdie pricing explainer](https://www.birdie.care/blog/price-of-care-management-software): plans start at £200/month excluding VAT and scale by scheduled care hours; it reports a broad sector range of £12–£35 per carer/month for combined rostering and care planning.
- [Unique IQ pricing](https://www.uniqueiq.co.uk/our-solutions/pricing-packages/): uses monthly packages with tailored quotes based on active carers and feature tier.
- [homecareOS pricing](https://www.homecareos.co.uk/pricing.html): publishes a low-cost competitor model of free up to five carers, then £10 per carer/month.

These references show a market split between fixed minimums, active-carer licences and scheduled-hours pricing. Based on this, use **sales-led, organisation-scoped pricing for domiciliary care** while launch packaging, service-model fit and implementation costs are validated. Quote against active carers and/or scheduled care volume, include office users, and state onboarding, support, VAT, contract term and any minimum charge explicitly. Do not infer or advertise a final MeticleCare price from competitor list prices. Revisit a published self-serve price only after customer interviews and cost-to-serve validation. This document is a product recommendation, not financial or tax advice.

## Stripe account

Use the same Stripe account and mode consistently. Production requires live credentials; test credentials must not be used by the production API.

Create and verify two recurring GBP prices in Stripe for the fixed self-serve plans:

- Starter — £99/month
- Professional — £299/month

Copy the resulting price IDs into the environment. The application validates their amount, currency and interval before use. Domiciliary pricing is different: each sales-agreed quote creates or reuses a Stripe price keyed by the exact monthly amount and VAT treatment. Before enabling that flow, confirm the production Stripe key has permission to create products and prices, and rehearsal verifies that repeated acceptance reuses the expected price and subscription rather than creating duplicate charges.

## GitHub Actions / VPS secrets

Configure these values in the production environment used by the VPS deployment:

```text
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
```

The web image also needs the live publishable key at build time:

```text
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Add it to the web build environment or Docker build arguments used by the deployment. Never put the secret key in frontend variables.

## Webhook endpoint

Create a live webhook endpoint for:

```text
https://meticlecare.com/api/billing/webhook
```

Subscribe to at least:

- `invoice.finalized`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.payment_action_required`
- `invoice.voided`
- `invoice.marked_uncollectible`
- `invoice.deleted`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`. The API verifies the raw request body, so do not proxy or transform the webhook JSON.

## Before enabling live payments

1. Confirm the two price IDs are live-mode IDs.
2. Confirm the publishable key and secret key belong to the same live Stripe account.
3. Confirm the webhook endpoint returns `200` for a valid signed event.
4. In Stripe test mode, use a separate test webhook secret and test price IDs only in local/staging environments.
5. Run one real low-value subscription transaction and verify:
   - the organisation receives a Stripe customer ID;
   - the subscription status updates;
   - an invoice is recorded;
   - the receipt email is delivered;
   - the Stripe dashboard shows the correct metadata key: `organizationId`.
6. Confirm production logs do not contain card numbers, CVCs, or client secrets.
7. For a domiciliary contract, set and audit an organisation-specific quote, confirm its VAT basis, accept it using the organisation's UK billing address and default card, then verify Stripe metadata and the recorded active monthly amount.
8. Verify declined-payment retry and webhook replay only affect the current organisation subscription; replayed event IDs must be idempotent.
9. Confirm the organisation sees its invoice history and can download invoices, and that the platform finance view excludes unaccepted domiciliary quotes and cancelled contracts.

## SMTP / transactional email

All transactional email (verification, reminders, receipts, dunning, portal links) is sent from the API via SMTP. Configure SMTP credentials as secrets in the production environment. Never store secret values in this checklist.

Notes:

- Create the billing/notification mailbox at your email host first.
- Keep `SMTP_FROM` aligned with the authenticated sender where possible.
- Configure SPF, DKIM and DMARC for the sending domain.
- Verify delivery with a test message and check the email queue logs.

## Local Stripe CLI

For local testing only:

```bash
stripe listen --forward-to localhost:3002/billing/webhook
```

Use the generated `whsec_...` value locally. Do not use the CLI forwarding secret as the production webhook secret.
