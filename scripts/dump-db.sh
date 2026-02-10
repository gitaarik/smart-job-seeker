#!/bin/bash
#
# Database backup script - creates two versions:
#
# 1. FULL (db-dumps/full.sql) - Complete database dump, git-ignored
#    Use this for full local restores
#
# 2. SMART (db-dumps/smart.sql) - Optimized for git
#    Excludes large tables that can be regenerated:
#    - ai_chats: LLM conversation logs (keeps last 25)
#    - jobs: Job postings (keeps last 25)
#    - directus_activity: Audit log (excluded)
#    - directus_revisions: Version history (excluded)
#

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$DIR/../db-dumps"

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

echo "Starting database backup..."
echo ""

# ============================================================================
# FULL BACKUP (git-ignored)
# ============================================================================
FULL_FILE="$OUTPUT_DIR/full.sql"
echo "  [1/2] Creating full backup..."
pg_dump -U postgres -d smartjobseeker > "$FULL_FILE"
FULL_SIZE=$(du -h "$FULL_FILE" | cut -f1)
echo "        ✓ Full backup: db-dumps/full.sql ($FULL_SIZE)"

# ============================================================================
# SMART BACKUP (git-tracked)
# ============================================================================
SMART_FILE="$OUTPUT_DIR/smart.sql"
echo ""
echo "  [2/2] Creating smart backup..."

# Step 1: Dump schema + data, excluding large tables
echo "        - Dumping schema and core data..."
pg_dump -U postgres -d smartjobseeker \
  --exclude-table-data=ai_chats \
  --exclude-table-data=jobs \
  --exclude-table-data=directus_activity \
  --exclude-table-data=directus_revisions \
  > "$SMART_FILE"

# Insert session_replication_role after pg_dump's \restrict command
# (needed because we exclude ai_chats/jobs data but other tables reference them)
# Find the line with \restrict and insert our SET command right after it
sed -i '/^\\restrict/a\-- Disable FK constraint triggers for restore (tables reference excluded ai_chats/jobs data)\nSET session_replication_role = '\''replica'\'';' "$SMART_FILE"

# Step 2: Append last 25 ai_chats rows (using SELECT * for maintainability)
echo "        - Appending last 25 ai_chats records..."
psql -U postgres -d smartjobseeker -c "
COPY (SELECT * FROM ai_chats ORDER BY id DESC LIMIT 25) TO STDOUT WITH (FORMAT csv, HEADER false, NULL 'NULL_VALUE')
" | {
  echo ""
  echo "-- Last 25 ai_chats records"
  echo "COPY public.ai_chats FROM stdin WITH (FORMAT csv, NULL 'NULL_VALUE');"
  cat
  echo "\\."
} >> "$SMART_FILE"

# Step 3: Append last 25 jobs (using SELECT * for maintainability)
echo "        - Appending last 25 jobs records..."
psql -U postgres -d smartjobseeker -c "
COPY (SELECT * FROM jobs ORDER BY id DESC LIMIT 25) TO STDOUT WITH (FORMAT csv, HEADER false, NULL 'NULL_VALUE')
" | {
  echo ""
  echo "-- Last 25 jobs records"
  echo "COPY public.jobs FROM stdin WITH (FORMAT csv, NULL 'NULL_VALUE');"
  cat
  echo "\\."
} >> "$SMART_FILE"

# Step 4: Re-enable FK triggers and clean up orphaned references
{
  echo ""
  echo "-- Re-enable FK constraint triggers"
  echo "SET session_replication_role = 'origin';"
  echo ""
  echo "-- Clean up orphaned FK references to ai_chats (excluded from partial backup)"
  echo "UPDATE public.jobs SET ai_chat_extraction = NULL WHERE ai_chat_extraction IS NOT NULL AND ai_chat_extraction NOT IN (SELECT id FROM public.ai_chats);"
  echo "UPDATE public.application_letters SET ai_chat = NULL WHERE ai_chat IS NOT NULL AND ai_chat NOT IN (SELECT id FROM public.ai_chats);"
  echo "UPDATE public.application_questions SET ai_chat = NULL WHERE ai_chat IS NOT NULL AND ai_chat NOT IN (SELECT id FROM public.ai_chats);"
  echo ""
  echo "-- Reset sequences after partial data import"
  echo "SELECT setval('public.ai_chats_id_seq', COALESCE((SELECT MAX(id) FROM public.ai_chats), 1));"
  echo "SELECT setval('public.jobs_id_seq', COALESCE((SELECT MAX(id) FROM public.jobs), 1));"
} >> "$SMART_FILE"

SMART_SIZE=$(du -h "$SMART_FILE" | cut -f1)
echo "        ✓ Smart backup: db-dumps/smart.sql ($SMART_SIZE)"

# Summary
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Backup complete!"
echo "  • Full:  db-dumps/full.sql ($FULL_SIZE) - git-ignored"
echo "  • Smart: db-dumps/smart.sql ($SMART_SIZE) - git-tracked"
echo "═══════════════════════════════════════════════════════"
