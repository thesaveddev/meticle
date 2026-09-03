#!/bin/bash
set -e

# Meticle deployment script
# Handles orphan containers, network splits, and Redis port conflicts

PROJECT_NAME="meticle"
COMPOSE_DIR="/opt/meticle"
COMPOSE_FILE="docker-compose.prod.yml"

echo "=== Meticle Deploy ==="

# 1. Clean up only containers from the retired Compose layout. Do not remove
# current production services; Compose will recreate them safely when needed.
echo "Cleaning retired orphan containers..."
for orphan in meticle-postgres-1 meticle-uptime-kuma-1; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${orphan}$"; then
    echo "  Removing retired orphan: $orphan"
    docker rm -f "$orphan" 2>/dev/null || true
  fi
done

# 2. Remove stale networks that no longer have containers
echo "Cleaning stale networks..."
for net in $(docker network ls --format '{{.Name}}' | grep "^${PROJECT_NAME}_"); do
  containers=$(docker network inspect "$net" --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null)
  if [ -z "$containers" ]; then
    echo "  Removing empty network: $net"
    docker network rm "$net" 2>/dev/null || true
  fi
done

# 3. Clean up old Docker images to prevent disk filling up
echo "Cleaning old Docker images..."
docker image prune -af --filter 'until=168h' 2>/dev/null && echo "  Removed images older than 7 days" || echo "  Image prune skipped"

# 4. Pull latest code
echo "Pulling latest code..."
cd "$COMPOSE_DIR"
git pull origin master

# 5. Use the production Compose project for every operation. The development
# compose file uses different service names and can recreate a second network.
cd "$COMPOSE_DIR"
if [ ! -f "$COMPOSE_FILE" ] || [ ! -f .env ]; then
  echo "ERROR: $COMPOSE_FILE or .env is missing"
  exit 1
fi
set -a
. ./.env
set +a
docker compose -f "$COMPOSE_FILE" config --quiet

# Remove only legacy containers from the retired Compose layout. Persistent
# volumes are intentionally left untouched.
for legacy in meticle-postgres-1 meticle-uptime-kuma-1; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${legacy}$"; then
    echo "Removing retired legacy container: $legacy"
    docker rm -f "$legacy" >/dev/null 2>&1 || true
  fi
done

# 6. Ensure infrastructure exists on the one production network.
echo "Starting production infrastructure..."
docker compose -f "$COMPOSE_FILE" up -d db redis uptime backup

# Keep the least-privilege application role synchronized with .env. This is
# safe to repeat and avoids stale pooled credentials after a secret rotation.
echo "Synchronizing application database role..."
docker compose -f "$COMPOSE_FILE" exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  psql -U meticle -d meticle -v app_password="$APP_ROLE_PASSWORD" \
  -c "ALTER ROLE meticle_app WITH LOGIN PASSWORD :'app_password';"

# 7. Run migrations and start the production services.
echo "Running migrations..."
docker compose -f "$COMPOSE_FILE" run --rm api sh -c "node apps/api/dist/shared/database/setup.js"
echo "Starting production services..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate api web

# 8. Wait for health
echo "Waiting for API to start..."
sleep 15

# 9. Verify
echo "=== Verification ==="
echo "Containers:"
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "Health:"
curl -s https://meticlecare.com/api/health/ready 2>/dev/null || echo "  Health check failed"

echo ""
echo "Redis:"
docker logs meticle-api-1 --tail 3 2>&1 | grep -i redis || echo "  No Redis logs"

echo ""
echo "=== Deploy complete ==="
