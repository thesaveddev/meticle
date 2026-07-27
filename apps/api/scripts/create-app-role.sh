#!/bin/bash
# create-app-role.sh — PostgreSQL init script, runs ONCE on first boot only.
# Creates the minimal-privilege app role used by the API at runtime.
# PostgreSQL superusers bypass ALL RLS, so the app must NOT connect as superuser.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create the role with LOGIN + password from env (default: dev-only fallback)
    DO \$\$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'meticle_app') THEN
        CREATE ROLE meticle_app WITH LOGIN PASSWORD '${APP_ROLE_PASSWORD:-dev_password_change_me}';
      END IF;
    END
    \$\$;
EOSQL

echo "[init] meticle_app role ready."
