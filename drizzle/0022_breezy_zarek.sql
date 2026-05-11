ALTER TABLE "job_platform_search_presets" ADD COLUMN "params" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "search_tasks" ADD COLUMN "search_filters" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint

-- Populate filter param mappings for well-known platforms. Each value is the
-- URL fragment ("key=value") appended to the resolved URL when the user
-- picks the matching option in the picker. Identified by platform key +
-- preset label so this stays valid across environments with different IDs.

UPDATE "job_platform_search_presets" s
SET "params" = '{
  "sort_by":       {"newest": "sortBy=DD"},
  "time_posted":   {"24h": "f_TPR=r86400", "week": "f_TPR=r604800", "month": "f_TPR=r2592000"},
  "work_location": {"onsite": "f_WT=1", "remote": "f_WT=2", "hybrid": "f_WT=3"},
  "job_type":      {"fulltime": "f_JT=F", "parttime": "f_JT=P", "contract": "f_JT=C", "internship": "f_JT=I"}
}'::jsonb
FROM "job_platforms" p
WHERE s."platform_id" = p."id" AND p."key" = 'linkedin' AND s."label" = 'Generic search';--> statement-breakpoint

UPDATE "job_platform_search_presets" s
SET "params" = '{
  "sort_by":       {"newest": "sort=date"},
  "time_posted":   {"24h": "fromage=1", "week": "fromage=7", "month": "fromage=30"},
  "work_location": {"remote": "remotejob=1"},
  "job_type":      {"fulltime": "jt=fulltime", "parttime": "jt=parttime", "contract": "jt=contract", "internship": "jt=internship"}
}'::jsonb
FROM "job_platforms" p
WHERE s."platform_id" = p."id" AND p."key" = 'indeed' AND s."label" = 'Generic search';--> statement-breakpoint

UPDATE "job_platform_search_presets" s
SET "params" = '{
  "sort_by":     {"newest": "sortBy=date_desc"},
  "time_posted": {"week": "fromAge=7", "month": "fromAge=30"}
}'::jsonb
FROM "job_platforms" p
WHERE s."platform_id" = p."id" AND p."key" LIKE 'glassdoor%' AND s."label" = 'Generic search';--> statement-breakpoint

UPDATE "job_platform_search_presets" s
SET "params" = '{"sort_by": {"newest": "sort=recency"}}'::jsonb
FROM "job_platforms" p
WHERE s."platform_id" = p."id" AND p."key" = 'upwork' AND s."label" = 'Generic search';--> statement-breakpoint

-- Consolidate LinkedIn "Remote only" + "Last 24 hours" into the Generic
-- preset + filter values. Migrate any tasks pointing at the redundant
-- presets first, then drop the presets.

UPDATE "search_tasks" t
SET preset_id = (SELECT s2.id FROM "job_platform_search_presets" s2
                 JOIN "job_platforms" p ON p.id = s2.platform_id
                 WHERE p.key = 'linkedin' AND s2.label = 'Generic search'),
    search_filters = '{"work_location": "remote"}'::jsonb
FROM "job_platform_search_presets" s
JOIN "job_platforms" p ON p.id = s.platform_id
WHERE t.preset_id = s.id AND p.key = 'linkedin' AND s.label = 'Remote only';--> statement-breakpoint

UPDATE "search_tasks" t
SET preset_id = (SELECT s2.id FROM "job_platform_search_presets" s2
                 JOIN "job_platforms" p ON p.id = s2.platform_id
                 WHERE p.key = 'linkedin' AND s2.label = 'Generic search'),
    search_filters = '{"time_posted": "24h"}'::jsonb
FROM "job_platform_search_presets" s
JOIN "job_platforms" p ON p.id = s.platform_id
WHERE t.preset_id = s.id AND p.key = 'linkedin' AND s.label = 'Last 24 hours';--> statement-breakpoint

DELETE FROM "job_platform_search_presets" s
USING "job_platforms" p
WHERE s.platform_id = p.id
  AND p.key = 'linkedin'
  AND s.label IN ('Remote only', 'Last 24 hours');
