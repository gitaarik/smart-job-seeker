#!/bin/bash
set -e

# Wait for PostgreSQL to be ready
echo "Waiting for database to be ready..."
until pg_isready -U postgres -h database -q; do
  sleep 2
done

echo "Database is ready!"

# Check if database has been initialized by checking if any tables exist
TABLE_COUNT=$(psql -U postgres -h database -d smartjobseeker -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")

if [ "$TABLE_COUNT" -eq "0" ]; then
  echo "Database is empty. Restoring from latest.sql dump..."
  psql -U postgres -h database -d smartjobseeker < /app/db-dumps/latest.sql
  echo "Database restored successfully!"
else
  echo "Database already initialized with $TABLE_COUNT tables. Skipping restore."
fi
