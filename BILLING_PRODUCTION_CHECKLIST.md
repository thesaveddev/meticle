# Billing production checklist

## Stripe account

Use the same Stripe account and mode consistently. Production requires live credentials; test credentials must not be used by the production API.

Create two recurring GBP prices in Stripe:

- Starter — £99/month
- Professional — £299/month

Copy the resulting price IDs. Do not rely on the application creating products or prices dynamically in production.

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

- `invoice.paid`
- `invoice.payment_failed`
- `invoice.payment_action_required`
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

## SMTP / transactional email

All transactional email (verification, reminders, receipts, dunning, portal links)
is sent from the API via SMTP. Configure in the VPS `/opt/meticle/.env`:

```text
SMTP_HOST=smtp.<your-host>.com        # e.g. smtp.zoho.eu, smtp.gmail.com
SMTP_PORT=587                          # 465 when SMTP_SECURE=true
SMTP_SECURE=false
SMTP_USER=notifications@meticlecare.com
SMTP_PASS=<mailbox password or app password>
SMTP_FROM=notifications@meticlecare.com
```

Notes:

- Create the `notifications@meticlecare.com` mailbox at your email/domain host
  first; the SMTP password is that mailbox's password (or an app password for
  providers that require one — historically SMTP/IMAP needs an app password).
- `SMTP_FROM` controls the visible sender. Keep it the same address as
  `SMTP_USER` to avoid SPF/DKIM alignment warnings.
- Enable SPF (`include:<provider>`), DKIM, and DMARC records for `meticlecare.com`
  in the domain's DNS so emails don't land in spam.
- After editing `.env`, recreate the API container so the new values load:
  `docker compose -f docker-compose.prod.yml up -d --force-recreate api`
- Verify delivery: send a password-reset or portal-link email and check it
  arrives; tail container logs for `Email queue batch processed` or errors.

## Local Stripe CLI

For local testing only:

```bash
stripe listen --forward-to localhost:3002/billing/webhook
```

Use the generated `whsec_...` value locally. Do not use the CLI forwarding secret as the production webhook secret.
