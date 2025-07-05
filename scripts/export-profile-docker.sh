#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <profile-id>"
  exit 1
fi

docker-compose exec app npx tsx scripts/export-profile.ts "$1"
docker-compose exec app chown -R 1000:984 exports/
