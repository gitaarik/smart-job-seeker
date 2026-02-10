#!/bin/bash
#
# Database initialization wrapper for Docker
# Selects the appropriate backup file and starts PostgreSQL:
# - Uses full.sql if available (complete backup, git-ignored)
# - Falls back to smart.sql (partial backup, git-tracked)
#

if [ -f /db-dumps/full.sql ]; then
  echo "Using full backup for database initialization"
  cp /db-dumps/full.sql /docker-entrypoint-initdb.d/init.sql
elif [ -f /db-dumps/smart.sql ]; then
  echo "Using smart backup for database initialization"
  cp /db-dumps/smart.sql /docker-entrypoint-initdb.d/init.sql
else
  echo "No backup file found, starting with empty database"
fi

exec docker-entrypoint.sh postgres
