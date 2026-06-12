-- Custom SQL migration file, put your code below! --

-- Profile side-projects and work-experiences now default to date ordering and
-- only switch to manual order once a user explicitly reorders them (which sets
-- `sort`). Existing rows carry a stale creation-order `sort`, so clear it to put
-- every profile back into date-default mode; users can re-pin via the new
-- "Reorder" control.
UPDATE "side_projects" SET "sort" = NULL;
--> statement-breakpoint
UPDATE "work_experiences" SET "sort" = NULL;
