#!/bin/bash
export PGUSER="${SJS_DB_USER:-postgres}"
export PGHOST="${SJS_DB_HOST:-database}"
export PGPASSWORD="${SJS_DB_PASSWORD:-postgres}"
export PGDATABASE="${SJS_DB_DATABASE:-smartjobseeker}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/../db-dumps/" || exit

read -p "This erases current database. Continue?" -n 1 -r
echo    # (optional) move to a new line
if [[ $REPLY =~ ^[Yy]$ ]]
then

  # Drop & recreate the database (WITH FORCE terminates active connections)
  psql -c "DROP DATABASE IF EXISTS $PGDATABASE WITH (FORCE)"
  psql -c "CREATE DATABASE $PGDATABASE"

  # Import the latest dump
  psql < smart.sql
else
  echo "Aborted"
fi

