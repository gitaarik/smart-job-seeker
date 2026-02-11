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

# Check if app tables exist (profiles table indicates app schema is initialized)
if db_query -c "SELECT 1 FROM profiles LIMIT 1" > /dev/null 2>&1; then
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
    echo "No backup found, running Prisma migrations..."
    npx dotenvx run -- prisma migrate deploy
  fi
fi

echo "=== Starting Vite dev server ==="
exec npx dotenvx run -- vite dev --host
