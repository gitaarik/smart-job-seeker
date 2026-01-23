#!/bin/bash
#
# Database backup script with size optimization
#
# Excludes large tables that can be regenerated:
# - ai_chat: LLM conversation logs (regeneratable)
# - jobs: Job postings (keeps last 25)
# - directus_activity: Audit log (not critical)
# - directus_revisions: Version history (not critical)
#

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$DIR/../db-dumps"
OUTPUT_FILE="$OUTPUT_DIR/latest.sql"

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

echo "Starting optimized database backup..."

# Step 1: Dump schema + data, excluding large tables
echo "  [1/3] Dumping schema and core data..."
pg_dump -U postgres -d smartjobseeker \
  --exclude-table-data=ai_chat \
  --exclude-table-data=jobs \
  --exclude-table-data=directus_activity \
  --exclude-table-data=directus_revisions \
  > "$OUTPUT_FILE"

# Step 2: Append last 25 ai_chat rows
echo "  [2/3] Appending last 25 ai_chat records..."
psql -U postgres -d smartjobseeker -c "
COPY (
  SELECT id, date_created, date_updated, profile, system_prompt, user_prompt,
         full_prompt, response, context, followup_to, error
  FROM ai_chat
  ORDER BY id DESC
  LIMIT 25
) TO STDOUT WITH (FORMAT csv, HEADER false, NULL 'NULL_VALUE')
" | {
  echo ""
  echo "-- Last 25 ai_chat records"
  echo "COPY ai_chat (id, date_created, date_updated, profile, system_prompt, user_prompt, full_prompt, response, context, followup_to, error) FROM stdin WITH (FORMAT csv, NULL 'NULL_VALUE');"
  cat
  echo "\\."
} >> "$OUTPUT_FILE"

# Step 3: Append last 25 jobs (with ai_chat_extraction set to NULL to avoid FK issues)
echo "  [3/3] Appending last 25 jobs records..."
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
} >> "$OUTPUT_FILE"

# Reset sequences to max id + 1
echo "" >> "$OUTPUT_FILE"
echo "-- Reset sequences after partial data import" >> "$OUTPUT_FILE"
echo "SELECT setval('ai_chat_id_seq', COALESCE((SELECT MAX(id) FROM ai_chat), 1));" >> "$OUTPUT_FILE"
echo "SELECT setval('jobs_id_seq', COALESCE((SELECT MAX(id) FROM jobs), 1));" >> "$OUTPUT_FILE"

# Report results
FILESIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo ""
echo "✓ Backup complete: db-dumps/latest.sql ($FILESIZE)"
