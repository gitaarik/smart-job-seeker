#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/../db-dumps/" || exit

# filename=$(date +'%Y-%m-%d_%H-%M-%S').sql
pg_dump -U postgres -d smartjobseeker > latest.sql
# ln -sf "$filename" latest.sql

echo "Created DB dump @ db-dumps/$filename"
