-- Let a role project say where it is shown, the way its technologies can.
--
-- Only the public portfolio site lists a role's projects; neither resume
-- layout prints them. The site printed every one, because this table had
-- nothing for the version filter to read, so a project could only be kept off
-- it by deleting it or by hiding the whole role. The column holds the same tags
-- as every other `tags` column (`resume`, `cv`, `portfolio`, a version slug, or
-- any of them negated), and null keeps the old behaviour, so no existing row
-- needs a value.
ALTER TABLE "work_experience_projects" ADD COLUMN "tags" json;