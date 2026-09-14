#!/bin/bash
# deploy.sh — Build and deploy Meticle to VPS
# Usage: ./scripts/deploy.sh [api|web|all]
set -euo pipefail

VPS="root@2.58.82.177"
SSH_KEY="$HOME/.ssh/id_rsa"
SSH="ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -i $SSH_KEY $VPS"
SCP="scp -o ConnectTimeout=10 -o StrictHostKeyChecking=no -i $SSH_KEY"
COMPOSE_DIR="/opt/meticle"
DEPLOY_TARGET="${1:-all}"

echo "=== Meticle Deploy ==="
echo "Target: $DEPLOY_TARGET"
echo ""

# ─── Build API ───
if [[ "$DEPLOY_TARGET" == "api" || "$DEPLOY_TARGET" == "all" ]]; then
  echo "▸ Building API..."
  cd apps/api
  npx tsc -p tsconfig.build.json
  
  # Copy migration SQL files to dist
  mkdir -p dist/shared/database/migrations
  cp src/shared/database/migrations/*.sql dist/shared/database/migrations/ 2>/dev/null || true
  cp src/shared/database/schema.sql dist/shared/database/ 2>/dev/null || true
  
  tar -czf /tmp/api-dist.tar.gz dist
  cd ../..
  
  echo "▸ Uploading API to VPS..."
  $SCP /tmp/api-dist.tar.gz $VPS:/tmp/api-dist.tar.gz
  
  echo "▸ Building API image on VPS..."
  $SSH "docker create --name _deploy-api --entrypoint sh meticle-api-latest -c 'sleep 300' 2>/dev/null || docker create --name _deploy-api --entrypoint sh node:20-slim -c 'sleep 300'"
  $SSH "docker start _deploy-api"
  $SSH "docker cp /tmp/api-dist.tar.gz _deploy-api:/tmp/api-dist.tar.gz"
  $SSH "docker exec _deploy-api sh -c 'cd /app/apps/api && rm -rf dist && tar xzf /tmp/api-dist.tar.gz && rm /tmp/api-dist.tar.gz'"
  $SSH "docker commit _deploy-api meticle-api-latest"
  $SSH "docker stop _deploy-api && docker rm _deploy-api"
  
  echo "▸ API image built: meticle-api-latest"
fi

# ─── Build Web ───
if [[ "$DEPLOY_TARGET" == "web" || "$DEPLOY_TARGET" == "all" ]]; then
  echo "▸ Building Web..."
  cd apps/web
  NODE_OPTIONS="--max-old-space-size=4096" npx vite build
  tar -czf /tmp/web-dist.tar.gz dist
  cd ../..
  
  echo "▸ Uploading Web to VPS..."
  $SCP /tmp/web-dist.tar.gz $VPS:/tmp/web-dist.tar.gz
  
  echo "▸ Building Web image on VPS..."
  $SSH "docker create --name _deploy-web --entrypoint sh meticle-web-latest -c 'sleep 300' 2>/dev/null || docker create --name _deploy-web --entrypoint sh nginx:alpine -c 'sleep 300'"
  $SSH "docker start _deploy-web"
  $SSH "docker cp /tmp/web-dist.tar.gz _deploy-web:/tmp/web-dist.tar.gz"
  $SSH "docker exec _deploy-web sh -c 'cd /usr/share/nginx/html && rm -rf assets index.html sw.js sw.mjs manifest.webmanifest && tar xzf /tmp/web-dist.tar.gz --strip-components=1 && rm /tmp/web-dist.tar.gz'"
  $SSH "docker commit _deploy-web meticle-web-latest"
  $SSH "docker stop _deploy-web && docker rm _deploy-web"
  
  echo "▸ Web image built: meticle-web-latest"
fi

# ─── Deploy with docker-compose ───
echo ""
echo "▸ Deploying with docker-compose..."
$SSH "cd $COMPOSE_DIR && docker compose -f docker-compose.deploy.yml up -d --force-recreate --no-deps api web 2>&1"

echo ""
echo "▸ Waiting for health checks..."
sleep 10

# ─── Verify ───
echo "▸ Verifying..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://meticlecare.com 2>/dev/null || echo "000")
API_STATUS=$($SSH "docker inspect meticle-api-1 --format '{{.State.Status}}' 2>/dev/null || echo 'not found'")

echo ""
echo "=== Deploy Complete ==="
echo "  Web:  https://meticlecare.com → $HTTP_CODE"
echo "  API:  $API_STATUS"
echo ""

if [[ "$HTTP_CODE" == "200" && "$API_STATUS" == "running" ]]; then
  echo "✓ All services healthy"
else
  echo "✗ Some services may need attention"
  echo "  Run: docker compose -f docker-compose.deploy.yml logs api --tail=20"
fi
