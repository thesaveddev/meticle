-- Migration 004: Create minimal-privilege application role
-- The app connects as this role at runtime; DDL runs via superuser (DATABASE_MIGRATE_URL).
-- PostgreSQL superusers bypass ALL RLS regardless of FORCE ROW LEVEL SECURITY,
-- so the app MUST NOT connect as a superuser in production.

-- 1. Create the role (LOGIN required for connection, NOCREATEDB/NOCREATEROLE for safety)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'meticle_app') THEN
    CREATE ROLE meticle_app WITH LOGIN NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

-- 2. Ensure schema usage
GRANT USAGE ON SCHEMA public TO meticle_app;

-- 3. Grant DML on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO meticle_app;

-- 4. Grant sequence usage (needed for SERIAL / GENERATED ALWAYS AS IDENTITY)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO meticle_app;

-- 5. Auto-grant on future tables (so new migrations don't break the app role)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO meticle_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO meticle_app;

-- 6. Explicitly REVOKE dangerous permissions
DO $$ BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM meticle_app', current_database());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
REVOKE CREATE ON SCHEMA public FROM meticle_app;
