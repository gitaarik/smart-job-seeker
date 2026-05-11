ALTER TABLE "job_platform_search_presets" ADD COLUMN "params" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "search_tasks" ADD COLUMN "search_filters" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint

-- Populate filter configurations for well-known platforms. Each filter entry
-- is either:
--   single-select: { "multi": false, "options": { value_key: url_fragment } }
--   multi-select:  { "multi": true, "param": "<key>", "sep": ",",
--                    "options": { value_key: raw_value } }
-- Identified by platform key + preset label so this stays valid across
-- environments with different IDs.

UPDATE "job_platform_search_presets" s
SET "params" = '{
  "sort_by":       {"multi": false, "options": {"newest": "sortBy=DD"}},
  "time_posted":   {"multi": false, "options": {"24h": "f_TPR=r86400", "week": "f_TPR=r604800", "month": "f_TPR=r2592000"}},
  "work_location": {"multi": true, "param": "f_WT", "sep": ",", "options": {"onsite": "1", "remote": "2", "hybrid": "3"}},
  "job_type":      {"multi": true, "param": "f_JT", "sep": ",", "options": {"fulltime": "F", "parttime": "P", "contract": "C", "internship": "I"}}
}'::jsonb
FROM "job_platforms" p
WHERE s."platform_id" = p."id" AND p."key" = 'linkedin' AND s."label" = 'Generic search';--> statement-breakpoint

UPDATE "job_platform_search_presets" s
SET "params" = '{
  "sort_by":       {"multi": false, "options": {"newest": "sort=date"}},
  "time_posted":   {"multi": false, "options": {"24h": "fromage=1", "week": "fromage=7", "month": "fromage=30"}},
  "work_location": {"multi": false, "options": {"remote": "remotejob=1"}},
  "job_type":      {"multi": true, "param": "jt", "sep": ",", "options": {"fulltime": "fulltime", "parttime": "parttime", "contract": "contract", "internship": "internship"}}
}'::jsonb
FROM "job_platforms" p
WHERE s."platform_id" = p."id" AND p."key" = 'indeed' AND s."label" = 'Generic search';--> statement-breakpoint

UPDATE "job_platform_search_presets" s
SET "params" = '{
  "sort_by":     {"multi": false, "options": {"newest": "sortBy=date_desc"}},
  "time_posted": {"multi": false, "options": {"week": "fromAge=7", "month": "fromAge=30"}}
}'::jsonb
FROM "job_platforms" p
WHERE s."platform_id" = p."id" AND p."key" LIKE 'glassdoor%' AND s."label" = 'Generic search';--> statement-breakpoint

UPDATE "job_platform_search_presets" s
SET "params" = '{"sort_by": {"multi": false, "options": {"newest": "sort=recency"}}}'::jsonb
FROM "job_platforms" p
WHERE s."platform_id" = p."id" AND p."key" = 'upwork' AND s."label" = 'Generic search';--> statement-breakpoint

-- Consolidate LinkedIn "Remote only" + "Last 24 hours" into the Generic
-- preset + filter values. Migrate any tasks pointing at the redundant
-- presets first, then drop the presets. work_location is multi-select on
-- LinkedIn so the value is stored as an array.

UPDATE "search_tasks" t
SET preset_id = (SELECT s2.id FROM "job_platform_search_presets" s2
                 JOIN "job_platforms" p ON p.id = s2.platform_id
                 WHERE p.key = 'linkedin' AND s2.label = 'Generic search'),
    search_filters = '{"work_location": ["remote"]}'::jsonb
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
