#!/bin/bash
# App container startup script
# Handles dependencies, database initialization, and dev server

set -e

# Database connection helper
db_query() {
  PGPASSWORD="${SJS_DB_PASSWORD:-postgres}" psql \
    -h "${SJS_DB_HOST:-database}" \
    -U "${SJS_DB_USER:-postgres}" \
    -d "${SJS_DB_DATABASE:-smartjobseeker}" \
    "$@"
}

echo "=== Installing dependencies ==="
npm ci --ignore-scripts --include=dev --legacy-peer-deps

echo "=== Installing Patchright Chromium (for PDF generation) ==="
npx patchright install chromium

echo "=== Syncing SvelteKit ==="
npx svelte-kit sync

echo "=== Generating Prisma client ==="
npx dotenvx run -- prisma generate
# Fix ownership so host user can regenerate (container runs as root)
chown -R "${HOST_UID:-1000}:${HOST_GID:-1000}" generated/ .svelte-kit/ 2>/dev/null || true

# Database initialization
if [ "$DB_RESET" = "true" ]; then
  echo "=== Reset mode: dropping all tables ==="
  db_query -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

  # Load dev seed BEFORE Directus starts (seed includes all schemas)
  if [ -f /db-dumps/dev-seed.sql ]; then
    echo "=== Loading dev seed (includes all schemas and data) ==="
    db_query -f /db-dumps/dev-seed.sql

    # No need for prisma db push - seed has all tables
    # Just sync any potential schema differences
    echo "=== Syncing Prisma schema ==="
    cd /app && npx dotenvx run -- prisma db push --accept-data-loss 2>/dev/null || true

    echo ""
    echo "============================================"
    echo "  Reset complete! Refresh your browser.    "
    echo "============================================"
  else
    echo "=== No seed file found, creating tables with prisma db push ==="
    cd /app && npx dotenvx run -- prisma db push --accept-data-loss

    echo "=== Seeding test user ==="
    cd /app && npx vite-node scripts/seed-test-user.ts

    echo ""
    echo "============================================"
    echo "  Reset complete! Refresh your browser.    "
    echo "============================================"
  fi

elif [ "$DB_RESTORE" = "true" ]; then
  echo "=== Restore mode: dropping all tables ==="
  db_query -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

  if [ -f /db-dumps/full.sql ]; then
    echo "=== Restoring from full backup ==="
    db_query -f /db-dumps/full.sql
  elif [ -f /db-dumps/smart.sql ]; then
    echo "=== Restoring from smart backup ==="
    db_query -f /db-dumps/smart.sql
  else
    echo "ERROR: No backup found in /db-dumps/. Cannot restore."
    exit 1
  fi

  echo ""
  echo "============================================"
  echo "  Restore complete! Refresh your browser.  "
  echo "============================================"

elif db_query -c "SELECT 1 FROM search_task_runs LIMIT 1" > /dev/null 2>&1; then
  echo "=== App tables already exist, skipping initialization ==="

  # Run idempotent column renames (safe to run every startup)
  if [ -f /app/scripts/migrate-column-renames.sql ]; then
    echo "=== Running column renames (idempotent) ==="
    db_query -f /app/scripts/migrate-column-renames.sql
  fi
else
  echo "=== App tables not found, initializing database ==="

  if [ -f /db-dumps/full.sql ]; then
    echo "Restoring from full backup..."
    db_query -f /db-dumps/full.sql
  elif [ -f /db-dumps/smart.sql ]; then
    echo "Restoring from smart backup..."
    db_query -f /db-dumps/smart.sql
  else
    echo "=== No backup found, creating tables with prisma db push ==="
    cd /app && npx dotenvx run -- prisma db push --accept-data-loss
  fi
fi

if [ "$NODE_ENV" = "development" ] || [ -z "$NODE_ENV" ]; then
  echo "=== Starting Vite dev server ==="
  exec npx dotenvx run -- vite dev --host
else
  echo "=== Building app ==="
  npx dotenvx run -- vite build

  echo "=== Starting Node server ==="
  exec npx dotenvx run -- node build
fi
