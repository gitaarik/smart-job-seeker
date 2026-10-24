-- The applicant's own part in a project, where it is not obvious: "tech lead"
-- on one project of a job whose title says something broader, "contributor" on
-- someone else's open-source project. Empty is the usual case and prints
-- nothing, so no existing row needs a value.
--
-- Not called `role`: in this codebase a role is a work experience.
ALTER TABLE "side_projects" ADD COLUMN "project_role" varchar(255);--> statement-breakpoint
ALTER TABLE "work_experience_projects" ADD COLUMN "project_role" varchar(255);