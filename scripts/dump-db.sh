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
#    - Tables with FK refs to jobs (keeps only rows for included jobs):
#      job_matches, job_match_history, job_importers, job_resources,
#      job_statuses, job_search_run_items
#    - directus_activity: Audit log (excluded)
#    - directus_revisions: Version history (excluded)
#

set -e

export PGUSER="${SJS_DB_USER:-postgres}"
export PGHOST="${SJS_DB_HOST:-database}"
export PGPASSWORD="${SJS_DB_PASSWORD:-postgres}"
export PGDATABASE="${SJS_DB_DATABASE:-smartjobseeker}"

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
pg_dump --no-owner --no-privileges > "$FULL_FILE"
FULL_SIZE=$(du -h "$FULL_FILE" | cut -f1)
echo "        ✓ Full backup: db-dumps/full.sql ($FULL_SIZE)"

# ============================================================================
# SMART BACKUP (git-tracked)
# ============================================================================
SMART_FILE="$OUTPUT_DIR/smart.sql"
echo ""
echo "  [2/2] Creating smart backup..."

# Step 1: Dump schema + data, excluding large tables
# --no-owner: Omit OWNER TO statements (allows restore as any user)
# --no-privileges: Omit GRANT/REVOKE statements
echo "        - Dumping schema and core data..."
pg_dump \
  --no-owner \
  --no-privileges \
  --exclude-table-data=ai_chats \
  --exclude-table-data=jobs \
  --exclude-table-data=job_matches \
  --exclude-table-data=job_match_history \
  --exclude-table-data=job_importers \
  --exclude-table-data=job_resources \
  --exclude-table-data=job_statuses \
  --exclude-table-data=directus_activity \
  --exclude-table-data=directus_revisions \
  > "$SMART_FILE"

# Disable FK triggers during restore (we include partial ai_chats/jobs data,
# but other tables may reference excluded rows during COPY)
# Insert BEFORE any COPY/data statements — find first COPY line and inject above it.
DISABLE_TRIGGERS=$(cat <<'TRIGGER_SQL'

-- Disable FK constraint triggers for restore (partial ai_chats/jobs data)
DO $$ BEGIN
  SET session_replication_role = 'replica';
EXCEPTION WHEN insufficient_privilege THEN
  -- Non-superuser: disable triggers on tables with FK refs to excluded data
  EXECUTE 'ALTER TABLE public.jobs DISABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE public.application_letters DISABLE TRIGGER ALL';
  EXECUTE 'ALTER TABLE public.application_questions DISABLE TRIGGER ALL';
END $$;

TRIGGER_SQL
)
# Insert before the first COPY statement (line with "^COPY ")
FIRST_COPY_LINE=$(grep -n '^COPY ' "$SMART_FILE" | head -1 | cut -d: -f1)
if [ -n "$FIRST_COPY_LINE" ]; then
  # Insert the trigger-disable block before the first COPY
  BEFORE_LINE=$((FIRST_COPY_LINE - 1))
  sed -i "${BEFORE_LINE}r /dev/stdin" "$SMART_FILE" <<< "$DISABLE_TRIGGERS"
fi

# Step 2: Append last 25 ai_chats rows (using SELECT * for maintainability)
echo "        - Appending last 25 ai_chats records..."
psql -c "
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
psql -c "
COPY (SELECT * FROM jobs ORDER BY id DESC LIMIT 25) TO STDOUT WITH (FORMAT csv, HEADER false, NULL 'NULL_VALUE')
" | {
  echo ""
  echo "-- Last 25 jobs records"
  echo "COPY public.jobs FROM stdin WITH (FORMAT csv, NULL 'NULL_VALUE');"
  cat
  echo "\\."
} >> "$SMART_FILE"

# Step 4: Append job-dependent table data (only rows for included jobs)
echo "        - Appending job-dependent table data..."
INCLUDED_JOBS_SUBQUERY="SELECT id FROM jobs ORDER BY id DESC LIMIT 25"

for TABLE_INFO in \
  "job_matches:job" \
  "job_match_history:job" \
  "job_importers:job" \
  "job_resources:job" \
  "job_statuses:job"
do
  TABLE="${TABLE_INFO%%:*}"
  FK_COL="${TABLE_INFO##*:}"

  psql -c "
COPY (SELECT * FROM ${TABLE} WHERE ${FK_COL} IN (${INCLUDED_JOBS_SUBQUERY})) TO STDOUT WITH (FORMAT csv, HEADER false, NULL 'NULL_VALUE')
" | {
    echo ""
    echo "-- ${TABLE} rows for included jobs"
    echo "COPY public.${TABLE} FROM stdin WITH (FORMAT csv, NULL 'NULL_VALUE');"
    cat
    echo "\\."
  } >> "$SMART_FILE"
done

# Step 5: Re-enable FK triggers and clean up orphaned references
{
  echo ""
  echo "-- Re-enable FK constraint triggers"
  echo "DO \$\$ BEGIN"
  echo "  SET session_replication_role = 'origin';"
  echo "EXCEPTION WHEN insufficient_privilege THEN"
  echo "  EXECUTE 'ALTER TABLE public.jobs ENABLE TRIGGER ALL';"
  echo "  EXECUTE 'ALTER TABLE public.application_letters ENABLE TRIGGER ALL';"
  echo "  EXECUTE 'ALTER TABLE public.application_questions ENABLE TRIGGER ALL';"
  echo "END \$\$;"
  echo ""
  echo "-- Clean up orphaned FK references (partial backup may have dangling refs)"
  echo "UPDATE public.jobs SET ai_chat_extraction = NULL WHERE ai_chat_extraction IS NOT NULL AND ai_chat_extraction NOT IN (SELECT id FROM public.ai_chats);"
  echo "UPDATE public.application_letters SET ai_chat = NULL WHERE ai_chat IS NOT NULL AND ai_chat NOT IN (SELECT id FROM public.ai_chats);"
  echo "UPDATE public.application_questions SET ai_chat = NULL WHERE ai_chat IS NOT NULL AND ai_chat NOT IN (SELECT id FROM public.ai_chats);"
  echo "UPDATE public.applications SET job = NULL WHERE job IS NOT NULL AND job NOT IN (SELECT id FROM public.jobs);"
  echo ""
  echo "-- Reset sequences after partial data import"
  echo "SELECT setval('public.ai_chats_id_seq', COALESCE((SELECT MAX(id) FROM public.ai_chats), 1));"
  echo "SELECT setval('public.jobs_id_seq', COALESCE((SELECT MAX(id) FROM public.jobs), 1));"
} >> "$SMART_FILE"

SMART_SIZE=$(du -h "$SMART_FILE" | cut -f1)
echo "        ✓ Smart backup: db-dumps/smart.sql ($SMART_SIZE)"

# Copy smart.sql to git-tracked OSS location (if running in cloud Docker setup)
# The app container mounts cloud/ at /cloud, so /cloud/oss/db-dumps/ is the
# git-tracked path, while /app/db-dumps/ maps to cloud/db-dumps/ (not tracked).
if [ -d /cloud/oss/db-dumps ]; then
  cp "$SMART_FILE" /cloud/oss/db-dumps/smart.sql
  echo "        ✓ Copied to oss/db-dumps/smart.sql (git-tracked)"
fi

# Summary
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Backup complete!"
echo "  • Full:  db-dumps/full.sql ($FULL_SIZE) - git-ignored"
echo "  • Smart: db-dumps/smart.sql ($SMART_SIZE) - git-tracked"
echo "═══════════════════════════════════════════════════════"
