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

# Fix ownership so host user can regenerate (container runs as root)
chown -R "${HOST_UID:-1000}:${HOST_GID:-1000}" .svelte-kit/ 2>/dev/null || true

# Database initialization
if [ "$DB_RESET" = "true" ]; then
  echo "=== Reset mode: dropping all tables ==="
  # The migration journal lives in its own schema, so dropping `public` alone
  # would leave it claiming migrations were applied to tables that no longer
  # exist — and the next `migrate` would skip everything and build nothing.
  db_query -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
  db_query -c "DROP SCHEMA IF EXISTS drizzle CASCADE;"

  # Schema from the migrations, exactly as deploy builds it. This used to be a
  # schema-carrying seed plus a `push` to paper over the difference, which meant
  # dev's schema was assembled a way no other environment's ever was.
  echo "=== Building schema from migrations ==="
  cd /app && npx dotenvx run -- npx tsx scripts/migrate-deploy.ts

  if [ -f /db-dumps/dev-seed.sql ]; then
    # A seed carrying its own schema cannot be loaded over one the migrations
    # just built. Refuse loudly rather than let psql half-apply it: the old
    # path did exactly that, with `push ... || true` papering over the result,
    # so a reset produced a table with both `profile` and `profile_id` and
    # nothing said so until a query failed hours later.
    if grep -qi "^CREATE TABLE" /db-dumps/dev-seed.sql; then
      echo ""
      echo "ERROR: dev-seed.sql carries its own schema, and the schema now"
      echo "comes from the migrations. Regenerate it (it will be data-only):"
      echo "  npm run docker:db:create-dev-seed"
      exit 1
    fi
    echo "=== Loading dev seed (data) ==="
    db_query -f /db-dumps/dev-seed.sql
  else
    echo "=== No seed file found, seeding test user ==="
    cd /app && npx vite-node scripts/seed-test-user.ts
  fi

  echo ""
  echo "============================================"
  echo "  Reset complete! Refresh your browser.    "
  echo "============================================"

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
else
  echo "=== App tables not found, initializing database ==="

  if [ -f /db-dumps/full.sql ]; then
    echo "Restoring from full backup..."
    db_query -f /db-dumps/full.sql
  elif [ -f /db-dumps/smart.sql ]; then
    echo "Restoring from smart backup..."
    db_query -f /db-dumps/smart.sql
  else
    echo "=== No backup found, building schema from migrations ==="
    cd /app && npx dotenvx run -- npx tsx scripts/migrate-deploy.ts
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
