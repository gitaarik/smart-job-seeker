#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/../db-dumps/" || exit

read -p "This erases current database. Continue?" -n 1 -r
echo    # (optional) move to a new line
if [[ $REPLY =~ ^[Yy]$ ]]
then

  # Drop & recreate the database (WITH FORCE terminates active connections)
  psql -U postgres -c "DROP DATABASE IF EXISTS smartjobseeker WITH (FORCE)"
  psql -U postgres -c "CREATE DATABASE smartjobseeker"

  # Import the latest dump
  psql -U postgres -d smartjobseeker < smart.sql
else
  echo "Aborted"
fi

