-- Let a certificate say which documents print it, the way a role, an education
-- entry or a skill already can.
--
-- Until now both resume renderers printed every certificate on every document,
-- because the table had nothing for the version filter to read: a certificate
-- that belonged on the CV and not on a two-page resume could only be deleted.
-- The column holds the same tags as every other `tags` column (`resume`, `cv`,
-- `portfolio`, a version slug, or any of them negated), and null keeps the old
-- behaviour, so no existing row needs a value.
ALTER TABLE "certificates" ADD COLUMN "tags" json;
