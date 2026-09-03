#!/usr/bin/env bash
set -Eeuo pipefail

# Meticle production deployment. CI supplies the exact release commit and the
# digest-pinned API/web image references. All host-specific paths and endpoints
# are configuration, not deployment logic.

: "${DEPLOY_DIR:?DEPLOY_DIR must identify the application checkout}"
: "${COMPOSE_FILE:?COMPOSE_FILE must identify the production Compose file}"
: "${RELEASE_SHA:?RELEASE_SHA must be the exact commit being released}"
: "${API_IMAGE_REF:?API_IMAGE_REF must be a digest-pinned API image reference}"
: "${WEB_IMAGE_REF:?WEB_IMAGE_REF must be a digest-pinned web image reference}"
: "${PUBLIC_SITE_URL:?PUBLIC_SITE_URL is required for production verification}"
: "${PUBLIC_API_HEALTH_URL:?PUBLIC_API_HEALTH_URL is required for production verification}"
: "${INTERNAL_API_HEALTH_URL:?INTERNAL_API_HEALTH_URL is required for API verification}"
: "${INTERNAL_WEB_URL:?INTERNAL_WEB_URL is required for web verification}"
: "${AUTH_LOGIN_URL:?AUTH_LOGIN_URL is required for authenticated smoke tests}"
: "${AUTH_ME_URL:?AUTH_ME_URL is required for authenticated smoke tests}"
: "${AUTH_SMOKE_EMAIL:?AUTH_SMOKE_EMAIL is required for authenticated smoke tests}"
: "${AUTH_SMOKE_PASSWORD:?AUTH_SMOKE_PASSWORD is required for authenticated smoke tests}"
: "${DEPLOY_ALERT_TO:?DEPLOY_ALERT_TO is required for deployment failure alerts}"
: "${DEPLOY_LOCK_FILE:?DEPLOY_LOCK_FILE is required}"
: "${RELEASE_STATE_DIR:?RELEASE_STATE_DIR is required}"
: "${RELEASE_RETENTION_COUNT:?RELEASE_RETENTION_COUNT is required}"
: "${MIN_FREE_KB:?MIN_FREE_KB is required}"

COMPOSE_PATH="$DEPLOY_DIR/$COMPOSE_FILE"
RELEASE_DIR="$DEPLOY_DIR/$RELEASE_STATE_DIR"

if ! [[ "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: RELEASE_SHA must be a full 40-character commit SHA" >&2
  exit 1
fi
if ! [[ "$RELEASE_RETENTION_COUNT" =~ ^[1-9][0-9]*$ ]]; then
  echo "ERROR: RELEASE_RETENTION_COUNT must be a positive integer" >&2
  exit 1
fi

cd "$DEPLOY_DIR"

compose() {
  docker compose -f "$COMPOSE_PATH" "$@"
}

container_image() {
  local service="$1"
  local container configured
  container=$(compose ps -q "$service" | head -1)
  [ -n "$container" ] || return 0
  configured=$(docker inspect "$container" --format '{{.Config.Image}}' 2>/dev/null || true)
  [ -n "$configured" ] || return 0
  docker image inspect "$configured" --format '{{index .RepoDigests 0}}' 2>/dev/null || true
}

require_immutable_image() {
  local image="$1"
  if [ -z "$image" ] || [[ "$image" == *":latest" ]] || [[ "$image" != *@sha256:* ]]; then
    echo "ERROR: image is missing or not digest-pinned: ${image:-<none>}" >&2
    exit 1
  fi
}

verify_public_health() {
  curl -fsS --max-time 20 "$PUBLIC_SITE_URL" >/dev/null
  curl -fsS --max-time 20 "$PUBLIC_API_HEALTH_URL" | grep -q '"status":"ok"'
}

wait_for_release_health() {
  local api_ok=false
  local web_ok=false
  local api_status="" web_status=""
  local api_container="" web_container=""

  for _ in $(seq 1 45); do
    api_container=$(compose ps -q api | head -1)
    web_container=$(compose ps -q web | head -1)
    api_status=$(docker inspect "$api_container" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)
    web_status=$(docker inspect "$web_container" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)

    if [ "$api_status" = "healthy" ] && curl -fsS --max-time 5 "$INTERNAL_API_HEALTH_URL" | grep -q '"status":"ok"'; then
      api_ok=true
    fi
    if [ "$web_status" = "healthy" ] && curl -fsS --max-time 5 "$INTERNAL_WEB_URL" >/dev/null; then
      web_ok=true
    fi
    if [ "$api_ok" = true ] && [ "$web_ok" = true ]; then
      return 0
    fi
    sleep 2
  done

  echo "API health: ${api_status:-missing}; web health: ${web_status:-missing}" >&2
  return 1
}

rollback_pair() {
  local reason="$1"
  echo "Release failed during $reason; rolling back API and web together"
  export API_IMAGE="$PREVIOUS_API_IMAGE"
  export WEB_IMAGE="$PREVIOUS_WEB_IMAGE"
  compose up -d --force-recreate api web
  if ! wait_for_release_health || ! verify_public_health; then
    echo "FATAL: coordinated rollback did not become healthy" >&2
    return 1
  fi
  echo "Coordinated API/web rollback is healthy"
}

assert_schema() {
  local result
  result=$(compose exec -T db psql -U meticle -d meticle -Atqc "
    SELECT CASE
      WHEN to_regclass('public._migrations') IS NULL THEN 'missing _migrations'
      WHEN to_regclass('public._migration_baselines') IS NULL THEN 'missing _migration_baselines'
      WHEN EXISTS (SELECT 1 FROM _migrations GROUP BY name HAVING COUNT(*) > 1) THEN 'duplicate migration rows'
      WHEN (SELECT COUNT(*) FROM _migration_baselines WHERE name IN ('001_initial', '033_incident_management', '039_operational_workflow_fields')) <> 3 THEN 'missing reviewed migration baselines'
      WHEN EXISTS (
        SELECT 1 FROM _migration_baselines b
        LEFT JOIN _migrations m ON m.name = b.name
        WHERE b.name IN ('001_initial', '033_incident_management', '039_operational_workflow_fields')
          AND (m.name IS NULL OR m.checksum <> b.checksum)
      ) THEN 'migration baseline checksum mismatch'
      WHEN (SELECT COUNT(*) FROM _migrations WHERE name = '059_email_queue_recovery') <> 1 THEN 'missing migration 059'
      WHEN (SELECT COUNT(*) FROM _migrations WHERE name = '060_cash_check_two_person_control') <> 1 THEN 'missing migration 060'
      WHEN (SELECT COUNT(*) FROM _migrations WHERE name = '061_cash_reconciliation_two_person') <> 1 THEN 'missing migration 061'
      WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_queue' AND column_name = 'sending_at') THEN 'missing email_queue.sending_at'
      WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_balance_checks') THEN 'missing cash_balance_checks'
      WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'person_expenses' AND column_name = 'is_voided') THEN 'missing expense audit columns'
      ELSE 'ok'
    END;
  ")
  if [ "$result" != "ok" ]; then
    echo "ERROR: post-migration schema assertion failed: $result" >&2
    return 1
  fi
  echo "Post-migration schema assertions passed"
}

run_authenticated_smoke() {
  local login_response access_token
  login_response=$(AUTH_EMAIL="$AUTH_SMOKE_EMAIL" AUTH_PASSWORD="$AUTH_SMOKE_PASSWORD" python3 - <<'PY' | curl -fsS --max-time 20 -H 'Content-Type: application/json' --data-binary @- "$AUTH_LOGIN_URL"
import json
import os
print(json.dumps({"email": os.environ["AUTH_EMAIL"], "password": os.environ["AUTH_PASSWORD"]}))
PY
  )
  access_token=$(printf '%s' "$login_response" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("accessToken", ""))')
  if [ -z "$access_token" ]; then
    echo "ERROR: authenticated smoke login did not return an access token" >&2
    return 1
  fi
  curl -fsS --max-time 20 -H "Authorization: Bearer $access_token" "$AUTH_ME_URL" >/dev/null
  echo "Authenticated login and /auth/me smoke tests passed"
}

retain_known_good_releases() {
  mkdir -p "$RELEASE_DIR"
  local marker="$RELEASE_DIR/$RELEASE_SHA.release"
  printf '%s\n%s\n' "$API_IMAGE_REF" "$WEB_IMAGE_REF" > "$marker"

  local index=0 old_marker old_api_image old_web_image
  while IFS= read -r old_marker; do
    index=$((index + 1))
    [ "$index" -le "$RELEASE_RETENTION_COUNT" ] && continue
    old_api_image=$(sed -n '1p' "$old_marker")
    old_web_image=$(sed -n '2p' "$old_marker")
    docker image rm "$old_api_image" "$old_web_image" >/dev/null 2>&1 || true
    rm -f "$old_marker"
  done < <(find "$RELEASE_DIR" -maxdepth 1 -type f -name '*.release' -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)

  # Remove only untagged layers; retained digest references remain available.
  docker image prune -f >/dev/null 2>&1 || true
  echo "Retained at least $RELEASE_RETENTION_COUNT known-good release records"
}

DEPLOY_STAGE="pre-deploy checks"
DEPLOY_FAILURE_NOTIFIED=0

notify_failure() {
  local exit_code="${1:-1}"
  if [ "$DEPLOY_FAILURE_NOTIFIED" -eq 1 ]; then
    return 0
  fi
  DEPLOY_FAILURE_NOTIFIED=1
  DEPLOY_EXIT_CODE="$exit_code" DEPLOY_STAGE="$DEPLOY_STAGE" DEPLOY_COMMIT="$RELEASE_SHA" DEPLOY_ALERT_TO="$DEPLOY_ALERT_TO" /usr/bin/python3 - <<'PY' || true
import os
import smtplib
import ssl
from email.mime.text import MIMEText


def load_env(path):
    values = {}
    try:
        with open(path, encoding="utf-8") as file:
            for raw_line in file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                    value = value[1:-1]
                values[key.strip()] = value
    except OSError:
        return values
    return values


config = load_env(os.path.join(os.environ["DEPLOY_DIR"], ".env"))
get = lambda key, default="": os.environ.get(key) or config.get(key, default)
host = get("SMTP_HOST")
user = get("SMTP_USER")
password = get("SMTP_PASS")
sender = get("SMTP_FROM")
recipient = os.environ.get("DEPLOY_ALERT_TO") or config.get("DEPLOY_ALERT_TO", "")
if not all((host, user, password, sender, recipient)):
    print("Deployment failure email skipped: SMTP configuration is incomplete")
    raise SystemExit(0)

stage = os.environ.get("DEPLOY_STAGE", "unknown stage")
commit = os.environ.get("DEPLOY_COMMIT", "unknown commit")
exit_code = os.environ.get("DEPLOY_EXIT_CODE", "1")
message = (
    "Meticle production deployment failed.\n\n"
    f"Stage: {stage}\n"
    f"Exit code: {exit_code}\n"
    f"Commit: {commit}\n"
    "Review the deployment logs and confirm the coordinated rollback is healthy.\n"
)
mail = MIMEText(message, "plain", "utf-8")
mail["Subject"] = f"Meticle deployment failed: {stage}"
mail["From"] = sender
mail["To"] = recipient
port = int(get("SMTP_PORT", "587"))
secure = get("SMTP_SECURE", "false").lower() == "true"
if secure:
    with smtplib.SMTP_SSL(host, port, timeout=20, context=ssl.create_default_context()) as server:
        server.login(user, password)
        server.send_message(mail)
else:
    with smtplib.SMTP(host, port, timeout=20) as server:
        server.starttls(context=ssl.create_default_context())
        server.login(user, password)
        server.send_message(mail)
print("Deployment failure email sent")
PY
}

# Take the host lock before touching source, images, containers, or the database.
mkdir -p "$(dirname "$DEPLOY_LOCK_FILE")"
exec 9>"$DEPLOY_LOCK_FILE"
if ! flock -w 900 9; then
  DEPLOY_STAGE="deployment lock acquisition"
  notify_failure 1
  echo "ERROR: another production deployment holds $DEPLOY_LOCK_FILE" >&2
  exit 1
fi
trap 'status=$?; if [ "$status" -ne 0 ]; then notify_failure "$status"; fi; flock -u 9; trap - EXIT; exit "$status"' EXIT

echo "Production deploy lock acquired"

if [ ! -f "$COMPOSE_PATH" ] || [ ! -f "$DEPLOY_DIR/.env" ]; then
  echo "ERROR: production Compose file or .env is missing" >&2
  exit 1
fi

AVAIL_KB=$(df "$DEPLOY_DIR" --output=avail -k | tail -1 | tr -d ' ')
if [ "$AVAIL_KB" -lt "$MIN_FREE_KB" ]; then
  echo "ERROR: only ${AVAIL_KB}KB is free; minimum is ${MIN_FREE_KB}KB" >&2
  exit 1
fi

DEPLOY_STAGE="source synchronization"
# Fetch only the production branch and reset to the exact release SHA selected by CI.
git fetch origin master --quiet
git cat-file -e "$RELEASE_SHA^{commit}"
git reset --hard "$RELEASE_SHA" --quiet

# Supply the candidate refs while Compose discovers the currently running
# containers; the Compose file requires image values for every command.
export API_IMAGE="$API_IMAGE_REF"
export WEB_IMAGE="$WEB_IMAGE_REF"

# Preserve the currently running pair as one rollback unit. A previous release
# without digest-pinned images is refused rather than making rollback unsafe.
PREVIOUS_API_IMAGE=$(container_image api)
PREVIOUS_WEB_IMAGE=$(container_image web)
require_immutable_image "$PREVIOUS_API_IMAGE"
require_immutable_image "$PREVIOUS_WEB_IMAGE"

require_immutable_image "$API_IMAGE_REF"
require_immutable_image "$WEB_IMAGE_REF"

DEPLOY_STAGE="image pull"
echo "Pulling digest-pinned release images"
docker pull "$API_IMAGE_REF"
docker pull "$WEB_IMAGE_REF"

DEPLOY_STAGE="infrastructure cleanup"
for orphan in meticle-postgres-1 meticle-uptime-kuma-1; do
  docker rm -f "$orphan" >/dev/null 2>&1 || true
done

DEPLOY_STAGE="infrastructure startup"
compose config --quiet
compose up -d db redis uptime backup

# Keep the least-privilege application role aligned with the production secret.
# Read only this value from the local env file; do not source the whole file.
DEPLOY_STAGE="database credential synchronization"
APP_ROLE_PASSWORD=$(sed -n 's/^APP_ROLE_PASSWORD=//p' "$DEPLOY_DIR/.env" | tail -1)
if [ -z "$APP_ROLE_PASSWORD" ]; then
  echo "ERROR: APP_ROLE_PASSWORD is missing from the production .env" >&2
  exit 1
fi
compose exec -T -e APP_ROLE_PASSWORD="$APP_ROLE_PASSWORD" db \
  psql -U meticle -d meticle -v app_password="$APP_ROLE_PASSWORD" \
  -c "ALTER ROLE meticle_app WITH LOGIN PASSWORD :'app_password';"

# Create and verify a complete backup before migrations can change production schema.
DEPLOY_STAGE="pre-migration backup"
echo "Creating pre-migration backup"
compose run --rm --no-deps --entrypoint sh backup -c 'sh /usr/local/bin/backup.sh && latest=$(ls -t /backups/meticle_*.sql.gz 2>/dev/null | head -1) && test -n "$latest" && test -s "$latest" && gzip -t "$latest"'
echo "Pre-migration backup verified"

DEPLOY_STAGE="database migrations"
# The migration command runs from the exact immutable API image selected above.
compose run --rm --no-deps api sh -c 'node apps/api/dist/shared/database/setup.js'
assert_schema

DEPLOY_STAGE="application rollout"
# Roll out API and web as one release unit, then verify both before public smoke tests.
if ! compose up -d --force-recreate api web || ! wait_for_release_health; then
  rollback_pair "application rollout" || exit 1
  exit 1
fi

DEPLOY_STAGE="production smoke tests"
if ! verify_public_health || ! run_authenticated_smoke; then
  rollback_pair "production smoke tests" || exit 1
  exit 1
fi

DEPLOY_STAGE="release retention"
retain_known_good_releases

DEPLOY_STAGE="complete"
echo "Production deployment complete: $RELEASE_SHA"
