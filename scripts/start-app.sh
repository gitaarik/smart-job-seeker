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
npm ci --ignore-scripts

echo "=== Syncing SvelteKit ==="
npx svelte-kit sync

echo "=== Generating Prisma client ==="
npx dotenvx run -- prisma generate

# Database initialization
if [ "$DB_RESET" = "true" ]; then
  echo "=== Reset mode: dropping all tables ==="
  db_query -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

  # Phase 2 runs in background after vite starts (allows Directus to initialize first)
  (
    echo "=== Waiting for Directus to initialize... ==="
    until curl -sf "${SJS_ADMIN_URL_DOCKER:-http://admin:8055}/server/health" > /dev/null 2>&1; do
      sleep 2
    done
    echo "=== Directus is ready ==="

    echo "=== Creating app tables with prisma db push ==="
    cd /app && npx dotenvx run -- prisma db push --accept-data-loss

    # Load dev seed if available, otherwise seed minimal test user
    if [ -f /db-dumps/dev-seed.sql ]; then
      echo "=== Loading dev seed data ==="
      db_query -f /db-dumps/dev-seed.sql
    else
      echo "=== Seeding test user ==="
      cd /app && npx vite-node scripts/seed-test-user.ts
    fi

    echo ""
    echo "============================================"
    echo "  Reset complete! Refresh your browser.    "
    echo "============================================"
  ) &

elif db_query -c "SELECT 1 FROM profiles LIMIT 1" > /dev/null 2>&1; then
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
    echo "ERROR: No backup found. Cannot initialize database."
    exit 1
  fi
fi

echo "=== Starting Vite dev server ==="
exec npx dotenvx run -- vite dev --host
