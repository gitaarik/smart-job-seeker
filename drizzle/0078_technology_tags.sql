-- Let a project's technologies say where they print, the way a role's already
-- can.
--
-- Only the public site lists a role project's or a side project's technologies;
-- neither resume layout prints them. The site printed every one, because these
-- tables had nothing for the version filter to read, so a technology could only
-- be kept off it by deleting it. The column holds the same tags as every other
-- `tags` column (`resume`, `cv`, `portfolio`, a version slug, or any of them
-- negated), and null keeps the old behaviour, so no existing row needs a value.
ALTER TABLE "side_project_technologies" ADD COLUMN "tags" json;--> statement-breakpoint
ALTER TABLE "work_experience_project_technologies" ADD COLUMN "tags" json;