#!/bin/bash
# Production app startup script
# The app is already built inside the Docker image — just run migrations and start.

set -e

# Database connection helper
db_query() {
  PGPASSWORD="${SJS_DB_PASSWORD:-postgres}" psql \
    -h "${SJS_DB_HOST:-database}" \
    -U "${SJS_DB_USER:-postgres}" \
    -d "${SJS_DB_DATABASE:-smartjobseeker}" \
    "$@"
}

# --- Database initialization (first deploy or restore) ---

if [ "$DB_RESTORE" = "true" ]; then
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
  echo "  Restore complete!"
  echo "============================================"

elif db_query -c "SELECT 1 FROM search_task_runs LIMIT 1" > /dev/null 2>&1; then
  echo "=== App tables already exist ==="
else
  echo "=== App tables not found, initializing database ==="

  if [ -f /db-dumps/full.sql ]; then
    echo "Restoring from full backup..."
    db_query -f /db-dumps/full.sql
  elif [ -f /db-dumps/smart.sql ]; then
    echo "Restoring from smart backup..."
    db_query -f /db-dumps/smart.sql
  else
    echo "=== No backup found, creating tables with drizzle-kit push ==="
    npx dotenvx run -- drizzle-kit push
  fi
fi

# --- Start Node server ---

echo "=== Starting production server ==="
exec npx dotenvx run -- node build
