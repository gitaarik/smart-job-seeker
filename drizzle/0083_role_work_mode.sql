-- Let a role say how it was worked: on-site, hybrid or remote.
--
-- The only place to say it was the location, so a remote role's location read
-- "Remote (Austin, USA)", and a template that prints the location in running
-- text printed the arrangement as a place: Citrus appends " in {location}." to
-- a role's headline. With the two apart, `location` is where the employer is
-- and each template words the arrangement itself. The values are the job
-- side's `work_location` words; null means not said and prints as before, so
-- no existing row needs a value.
ALTER TABLE "work_experiences" ADD COLUMN "work_mode" varchar(16);
