#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/../db-dumps/" || exit

read -p "This erases current database. Continue?" -n 1 -r
echo    # (optional) move to a new line
if [[ $REPLY =~ ^[Yy]$ ]]
then
  psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'smartjobseeker' AND pid <> pg_backend_pid()"
  psql -U postgres -c "DROP DATABASE smartjobseeker"
  psql -U postgres -c "CREATE DATABASE smartjobseeker"
  psql -U postgres -d smartjobseeker < latest.sql
fi

