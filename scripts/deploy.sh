#!/usr/bin/env bash
# Production deploy entrypoint used by CI. Images are built and published by
# GitHub Actions; this script only pulls immutable images, migrates, rolls out,
# and verifies the pair.
set -Eeuo pipefail

: "${DEPLOY_DIR:?DEPLOY_DIR is required}"
: "${COMPOSE_FILE:?COMPOSE_FILE is required}"
: "${API_IMAGE_REF:?API_IMAGE_REF is required}"
: "${WEB_IMAGE_REF:?WEB_IMAGE_REF is required}"
: "${PUBLIC_SITE_URL:?PUBLIC_SITE_URL is required}"
: "${PUBLIC_API_HEALTH_URL:?PUBLIC_API_HEALTH_URL is required}"
: "${INTERNAL_API_HEALTH_URL:?INTERNAL_API_HEALTH_URL is required}"
: "${INTERNAL_WEB_URL:?INTERNAL_WEB_URL is required}"
: "${MIN_FREE_KB:?MIN_FREE_KB is required}"

case "$API_IMAGE_REF" in *@sha256:*) ;; *) echo "API image must be digest-pinned" >&2; exit 1 ;; esac
case "$WEB_IMAGE_REF" in *@sha256:*) ;; *) echo "Web image must be digest-pinned" >&2; exit 1 ;; esac

COMPOSE_PATH="$DEPLOY_DIR/$COMPOSE_FILE"
LOCK_FILE="${DEPLOY_LOCK_FILE:-$DEPLOY_DIR/.deploy.lock}"
mkdir -p "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
flock -w 900 9
trap 'status=$?; flock -u 9; exit "$status"' EXIT

cd "$DEPLOY_DIR"
[ -f "$COMPOSE_PATH" ] || { echo "Missing Compose file: $COMPOSE_PATH" >&2; exit 1; }
[ -f "$DEPLOY_DIR/.env" ] || { echo "Missing production .env" >&2; exit 1; }

available_kb=$(df "$DEPLOY_DIR" --output=avail -k | tail -1 | tr -d ' ')
[ "$available_kb" -ge "$MIN_FREE_KB" ] || { echo "Only ${available_kb}KB free; need ${MIN_FREE_KB}KB" >&2; exit 1; }

compose() { docker compose -f "$COMPOSE_PATH" "$@"; }

previous_image() {
  local service container image
  container=$(compose ps -q "$1" | head -1)
  [ -n "$container" ] || return 0
  image=$(docker inspect "$container" --format '{{.Config.Image}}' 2>/dev/null || true)
  [ -n "$image" ] || return 0
  docker image inspect "$image" --format '{{index .RepoDigests 0}}' 2>/dev/null || true
}

wait_for_health() {
  for _ in $(seq 1 45); do
    if curl -fsS --max-time 5 "$INTERNAL_API_HEALTH_URL" | grep -q '"status":"ok"' \
      && curl -fsS --max-time 5 "$INTERNAL_WEB_URL" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  compose ps
  return 1
}

verify_public() {
  curl -fsS --max-time 20 "$PUBLIC_SITE_URL" >/dev/null
  curl -fsS --max-time 20 "$PUBLIC_API_HEALTH_URL" | grep -q '"status":"ok"'
}

rollback() {
  [ -n "${PREVIOUS_API_IMAGE:-}" ] && [ -n "${PREVIOUS_WEB_IMAGE:-}" ] || return 1
  export API_IMAGE="$PREVIOUS_API_IMAGE" WEB_IMAGE="$PREVIOUS_WEB_IMAGE"
  compose up -d --force-recreate api web >/dev/null
  wait_for_health && verify_public
}

export API_IMAGE="$API_IMAGE_REF" WEB_IMAGE="$WEB_IMAGE_REF"
PREVIOUS_API_IMAGE=$(previous_image api)
PREVIOUS_WEB_IMAGE=$(previous_image web)

compose config --quiet
docker pull "$API_IMAGE_REF"
docker pull "$WEB_IMAGE_REF"

# Start dependencies first, then make a verified backup before schema changes.
compose up -d db redis backup >/dev/null
if compose run --rm --no-deps backup sh /usr/local/bin/backup.sh; then
  echo "Pre-deploy database backup completed"
else
  echo "Database backup failed; refusing to deploy" >&2
  exit 1
fi

# Migrations run from the exact API image being released.
compose run --rm --no-deps api node apps/api/dist/shared/database/setup.js

if ! compose up -d --force-recreate api web >/dev/null || ! wait_for_health || ! verify_public; then
  echo "Release failed health verification; attempting coordinated rollback" >&2
  rollback || { echo "Rollback failed" >&2; exit 1; }
  exit 1
fi

echo "Production release ${RELEASE_SHA:-unknown} is healthy"
