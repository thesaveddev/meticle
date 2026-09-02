#!/bin/bash
set -e

# Meticle deployment script
# Handles orphan containers, network splits, and Redis port conflicts

PROJECT_NAME="meticle"
COMPOSE_DIR="/opt/meticle"

echo "=== Meticle Deploy ==="

# 1. Clean up orphan containers from previous compose projects
echo "Cleaning orphan containers..."
for orphan in meticle-db-1 meticle-uptime-1; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${orphan}$"; then
    echo "  Removing orphan: $orphan"
    docker stop "$orphan" 2>/dev/null || true
    docker rm "$orphan" 2>/dev/null || true
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

# 3. Pull latest code
echo "Pulling latest code..."
cd "$COMPOSE_DIR"
git pull origin master

# 4. Ensure Redis port is correct (defensive — prevents the recurring 6379 conflict)
if grep -q "'6379:6379'" docker-compose.yml; then
  echo "Fixing Redis port conflict (6379 -> 6380)..."
  sed -i "s/'6379:6379'/'6380:6379'/g" docker-compose.yml
fi

# 5. Fix postgres superuser login via single-user mode (recurring issue)
echo "Ensuring postgres superuser can log in..."
docker stop meticle-api-1 2>/dev/null || true
docker stop meticle-postgres-1 2>/dev/null || true
docker run --rm -u postgres \
  -v ${PROJECT_NAME}_postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine sh -c \
  "echo \"ALTER ROLE postgres WITH LOGIN PASSWORD 'postgres';\" | postgres --single -D /var/lib/postgresql/data postgres 2>&1" \
  && echo "  Postgres superuser login enabled" || echo "  Warning: could not fix postgres role (may already be OK)"

docker start meticle-postgres-1
sleep 5

# 6. Build and start
echo "Building and starting services..."
docker compose up -d --build --force-recreate api web

# 7. Wait for health
echo "Waiting for API to start..."
sleep 15

# 8. Verify
echo "=== Verification ==="
echo "Containers:"
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep meticle

echo ""
echo "Health:"
curl -s https://meticlecare.com/api/health/ready 2>/dev/null || echo "  Health check failed"

echo ""
echo "Redis:"
docker logs meticle-api-1 --tail 3 2>&1 | grep -i redis || echo "  No Redis logs"

echo ""
echo "=== Deploy complete ==="
