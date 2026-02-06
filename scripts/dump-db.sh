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

# Step 2: Append last 25 ai_chats rows
echo "        - Appending last 25 ai_chats records..."
psql -U postgres -d smartjobseeker -c "
COPY (
  SELECT id, date_created, date_updated, profile, system_prompt, user_prompt,
         full_prompt, response, context, followup_to, error
  FROM ai_chats
  ORDER BY id DESC
  LIMIT 25
) TO STDOUT WITH (FORMAT csv, HEADER false, NULL 'NULL_VALUE')
" | {
  echo ""
  echo "-- Last 25 ai_chats records"
  echo "COPY ai_chats (id, date_created, date_updated, profile, system_prompt, user_prompt, full_prompt, response, context, followup_to, error) FROM stdin WITH (FORMAT csv, NULL 'NULL_VALUE');"
  cat
  echo "\\."
} >> "$SMART_FILE"

# Step 3: Append last 25 jobs (with ai_chat_extraction set to NULL to avoid FK issues)
echo "        - Appending last 25 jobs records..."
psql -U postgres -d smartjobseeker -c "
COPY (
  SELECT id, status, date_created, date_updated, source_url, title, job_description,
         job_poster, company_description, date_posted, salary_min, salary_max,
         salary_currency, salary_period, import_error, last_scraped, location,
         scrape_count, job_types, experience_levels, remote_options, skills,
         source_html_stripped, job_platform,
         NULL as ai_chat_extraction  -- Set to NULL to avoid FK constraint issues
  FROM jobs
  ORDER BY id DESC
  LIMIT 25
) TO STDOUT WITH (FORMAT csv, HEADER false, NULL 'NULL_VALUE')
" | {
  echo ""
  echo "-- Last 25 jobs records (ai_chat_extraction set to NULL)"
  echo "COPY jobs (id, status, date_created, date_updated, source_url, title, job_description, job_poster, company_description, date_posted, salary_min, salary_max, salary_currency, salary_period, import_error, last_scraped, location, scrape_count, job_types, experience_levels, remote_options, skills, source_html_stripped, job_platform, ai_chat_extraction) FROM stdin WITH (FORMAT csv, NULL 'NULL_VALUE');"
  cat
  echo "\\."
} >> "$SMART_FILE"

# Reset sequences to max id + 1
echo "" >> "$SMART_FILE"
echo "-- Reset sequences after partial data import" >> "$SMART_FILE"
echo "SELECT setval('ai_chats_id_seq', COALESCE((SELECT MAX(id) FROM ai_chats), 1));" >> "$SMART_FILE"
echo "SELECT setval('jobs_id_seq', COALESCE((SELECT MAX(id) FROM jobs), 1));" >> "$SMART_FILE"

SMART_SIZE=$(du -h "$SMART_FILE" | cut -f1)
echo "        ✓ Smart backup: db-dumps/smart.sql ($SMART_SIZE)"

# Summary
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Backup complete!"
echo "  • Full:  db-dumps/full.sql ($FULL_SIZE) - git-ignored"
echo "  • Smart: db-dumps/smart.sql ($SMART_SIZE) - git-tracked"
echo "═══════════════════════════════════════════════════════"
