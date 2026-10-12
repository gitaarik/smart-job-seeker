#!/bin/bash
# Production app startup script
# The app is already built inside the Docker image. This builds the schema of an
# empty database (or restores one, with DB_RESTORE=true) and starts the server.
# Pending migrations on an existing database are deploy.sh's step, not this one.

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
    # From the migrations, which is how deploy.sh expects to find it. This was
    # `drizzle-kit push`, which builds the tables from schema.ts but leaves the
    # migration journal empty, so deploy.sh's migrate step then re-ran 0000 and
    # died on its first statement; push also creates no triggers (0030, 0076).
    echo "=== No backup found, building schema from migrations ==="
    npx dotenvx run -- npx tsx scripts/migrate-deploy.ts
  fi
fi

# --- Start Node server ---

echo "=== Starting production server ==="
exec npx dotenvx run -- node build
