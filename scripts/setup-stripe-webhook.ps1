# ─────────────────────────────────────────────────────────────
#  Meticle — Stripe Webhook Setup (Windows PowerShell)
#
#  Prerequisites:
#    1. Install Stripe CLI:  scoop install stripe-cli
#       (or https://docs.stripe.com/stripe-cli#install)
#    2. Authenticate:        stripe login
#
#  Usage:
#    .\scripts\setup-stripe-webhook.ps1
# ─────────────────────────────────────────────────────────────

$WebhookUrl = "https://meticlecare.com/api/billing/webhook"

$Events = @(
    "invoice.paid"
    "invoice.payment_failed"
    "invoice.payment_action_required"
    "customer.subscription.updated"
    "customer.subscription.deleted"
)

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       Meticle — Stripe Webhook Setup             ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check Stripe CLI
if (-not (Get-Command stripe -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Stripe CLI not found." -ForegroundColor Red
    Write-Host ""
    Write-Host "Install: scoop install stripe-cli"
    Write-Host "Then:    stripe login"
    exit 1
}

Write-Host "✓ Stripe CLI found" -ForegroundColor Green
Write-Host ""
Write-Host "Creating webhook endpoint..."
Write-Host "  URL: $WebhookUrl"
Write-Host "  Events:"
foreach ($event in $Events) {
    Write-Host "    - $event"
}
Write-Host ""

# Create webhook
$eventArgs = $Events | ForEach-Object { "--enabled-events"; $_ }
$output = stripe webhook_endpoints create --url $WebhookUrl @eventArgs --description "Meticle billing webhooks" --connect false 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create webhook endpoint." -ForegroundColor Red
    Write-Host $output
    exit 1
}

# Parse output
$webhookId = ($output | Select-String '"id":\s*"(we_[^"]+)"').Matches.Groups[1].Value
$signingSecret = ($output | Select-String '"secret":\s*"([^"]+)"').Matches.Groups[1].Value

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "✓ Webhook endpoint created!" -ForegroundColor Green
Write-Host ""
Write-Host "  Webhook ID:  $webhookId"

if ($signingSecret) {
    Write-Host "  Signing Secret: $signingSecret"
    Write-Host ""
    Write-Host "───────────────────────────────────────────────────" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Add this to your VPS .env file:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  STRIPE_WEBHOOK_SECRET=$signingSecret" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "  Go to: https://dashboard.stripe.com/webhooks/$webhookId"
    Write-Host "  Click 'Reveal' under Signing secret"
}

Write-Host "───────────────────────────────────────────────────" -ForegroundColor Yellow
Write-Host ""
Write-Host "Also make sure this is in your VPS .env:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  STRIPE_SECRET_KEY=sk_live_YOUR_KEY_HERE" -ForegroundColor White
Write-Host ""
Write-Host "Then recreate the API container:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  ssh root@YOUR_VPS" -ForegroundColor White
Write-Host "  cd /opt/meticle" -ForegroundColor White
Write-Host "  docker compose -f docker-compose.prod.yml up -d --force-recreate api" -ForegroundColor White
Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Verify it's working:" -ForegroundColor Yellow
Write-Host ""
Write-Host '  curl -s -X POST https://meticlecare.com/api/billing/webhook -H "Content-Type: application/json" -d "{}"' -ForegroundColor White
Write-Host ""
Write-Host "Expected: 400 (missing stripe-signature header)" -ForegroundColor Gray
Write-Host ""
