#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Meticle — Stripe Webhook Setup Script
#
#  Prerequisites:
#    1. Install Stripe CLI:  brew install stripe/stripe-cli/stripe
#       (or https://docs.stripe.com/stripe-cli#install)
#    2. Authenticate:        stripe login
#
#  Usage:
#    chmod +x scripts/setup-stripe-webhook.sh
#    ./scripts/setup-stripe-webhook.sh
#
#  What it does:
#    - Creates a webhook endpoint for https://meticlecare.com/api/billing/webhook
#    - Subscribes to all required billing events
#    - Prints the signing secret you need for your VPS .env
# ─────────────────────────────────────────────────────────────
set -euo pipefail

WEBHOOK_URL="https://meticlecare.com/api/billing/webhook"

EVENTS=(
  "invoice.paid"
  "invoice.payment_failed"
  "invoice.payment_action_required"
  "customer.subscription.updated"
  "customer.subscription.deleted"
)

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       Meticle — Stripe Webhook Setup             ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Check Stripe CLI is installed
if ! command -v stripe &>/dev/null; then
  echo "ERROR: Stripe CLI not found."
  echo ""
  echo "Install it first:"
  echo "  macOS:   brew install stripe/stripe-cli/stripe"
  echo "  Windows: scoop install stripe-cli"
  echo "  Linux:   https://docs.stripe.com/stripe-cli#install"
  echo ""
  echo "Then authenticate:"
  echo "  stripe login"
  echo ""
  exit 1
fi

# Check Stripe CLI is authenticated
if ! stripe config get device_id &>/dev/null 2>&1; then
  echo "ERROR: Stripe CLI not authenticated."
  echo ""
  echo "Run: stripe login"
  echo ""
  exit 1
fi

echo "✓ Stripe CLI found and authenticated"
echo ""
echo "Creating webhook endpoint..."
echo "  URL: ${WEBHOOK_URL}"
echo "  Events:"
for event in "${EVENTS[@]}"; do
  echo "    - ${event}"
done
echo ""

# Create the webhook endpoint
WEBHOOK_ID=$(stripe webhook_endpoints create \
  --url "${WEBHOOK_URL}" \
  --enabled-events "${EVENTS[*]}" \
  --description "Meticle billing webhooks" \
  --connect false \
  2>&1)

if [ $? -ne 0 ]; then
  echo "ERROR: Failed to create webhook endpoint."
  echo ""
  echo "Possible causes:"
  echo "  - You're not authenticated (run: stripe login)"
  echo "  - The URL is already registered"
  echo "  - Your Stripe account doesn't have webhook permissions"
  echo ""
  echo "Full output:"
  echo "${WEBHOOK_ID}"
  exit 1
fi

# Extract the webhook ID and signing secret
WEBHOOK_ENDPOINT_ID=$(echo "${WEBHOOK_ID}" | grep -o '"id": "we_[^"]*"' | head -1 | cut -d'"' -f4)
SIGNING_SECRET=$(echo "${WEBHOOK_ID}" | grep -o '"secret": "[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "${WEBHOOK_ENDPOINT_ID}" ]; then
  echo "WARNING: Could not extract webhook ID from response."
  echo "Full response:"
  echo "${WEBHOOK_ID}"
  echo ""
  echo "You can find it in: https://dashboard.stripe.com/webhooks"
  exit 1
fi

echo "═══════════════════════════════════════════════════"
echo ""
echo "✓ Webhook endpoint created successfully!"
echo ""
echo "  Webhook ID:  ${WEBHOOK_ENDPOINT_ID}"
echo ""
if [ -n "${SIGNING_SECRET}" ]; then
  echo "  Signing Secret: ${SIGNING_SECRET}"
  echo ""
  echo "───────────────────────────────────────────────────"
  echo ""
  echo "Add this to your VPS .env file:"
  echo ""
  echo "  STRIPE_WEBHOOK_SECRET=${SIGNING_SECRET}"
  echo ""
  echo "───────────────────────────────────────────────────"
else
  echo "  Signing Secret: (check Stripe Dashboard)"
  echo ""
  echo "  Go to: https://dashboard.stripe.com/webhooks/${WEBHOOK_ENDPOINT_ID}"
  echo "  Click 'Reveal' under Signing secret"
  echo ""
fi

echo "Also make sure this is in your VPS .env:"
echo ""
echo "  STRIPE_SECRET_KEY=sk_live_YOUR_KEY_HERE"
echo ""
echo "Then recreate the API container:"
echo ""
echo "  ssh root@YOUR_VPS"
echo "  cd /opt/meticle"
echo "  docker compose -f docker-compose.prod.yml up -d --force-recreate api"
echo ""
echo "═══════════════════════════════════════════════════"
echo ""
echo "Verify it's working:"
echo ""
echo "  curl -s -X POST https://meticlecare.com/api/billing/webhook \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{}'"
echo ""
echo "Expected: 400 (missing stripe-signature header)"
echo "If you see 503, the STRIPE_SECRET_KEY isn't set yet."
echo ""
