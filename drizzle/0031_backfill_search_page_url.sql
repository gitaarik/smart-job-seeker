-- NO-OP — the original backfill SQL referenced `job_platforms.search_page_url`,
-- which wasn't actually added to the schema until 0033. Running 0031 on a fresh
-- DB therefore failed with "column does not exist". The same backfill now lives
-- in 0034, which sequences correctly after 0033.
--
-- Left as a placeholder rather than deleted so the journal's idx sequence
-- stays contiguous and any environment that already recorded 0031 as applied
-- (via push, etc.) doesn't re-run a missing migration.

SELECT 1;
