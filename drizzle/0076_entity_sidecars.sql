CREATE INDEX "profile_translations_entity_idx" ON "profile_translations" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "profile_version_overrides_entity_idx" ON "profile_version_overrides" USING btree ("entity_type","entity_id");--> statement-breakpoint
-- A row that a CV version's override or a translation names takes those with
-- it when it is deleted. Neither table can hold a foreign key to the row (each
-- serves many kinds), so until now every way of deleting one had to remember,
-- and the skills page did not. Statement-level, so a resume import or the
-- cascade under a deleted role clears its rows in one pass rather than one
-- query per row. See profile_version_overrides in schema.ts.
CREATE OR REPLACE FUNCTION delete_entity_sidecars() RETURNS trigger AS $$
BEGIN
	DELETE FROM profile_version_overrides o
		USING gone g
		WHERE o.entity_type = TG_ARGV[0] AND o.entity_id = g.id;
	DELETE FROM profile_translations t
		USING gone g
		WHERE t.entity_type = TG_ARGV[0] AND t.entity_id = g.id;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER work_experiences_delete_sidecars AFTER DELETE ON "work_experiences"
	REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
	EXECUTE FUNCTION delete_entity_sidecars('work_experience');
--> statement-breakpoint
CREATE TRIGGER work_experience_achievements_delete_sidecars AFTER DELETE ON "work_experience_achievements"
	REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
	EXECUTE FUNCTION delete_entity_sidecars('work_experience_achievement');
--> statement-breakpoint
CREATE TRIGGER work_experience_technologies_delete_sidecars AFTER DELETE ON "work_experience_technologies"
	REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
	EXECUTE FUNCTION delete_entity_sidecars('work_experience_technology');
--> statement-breakpoint
CREATE TRIGGER work_experience_projects_delete_sidecars AFTER DELETE ON "work_experience_projects"
	REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
	EXECUTE FUNCTION delete_entity_sidecars('work_experience_project');
--> statement-breakpoint
CREATE TRIGGER tech_skill_categories_delete_sidecars AFTER DELETE ON "tech_skill_categories"
	REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
	EXECUTE FUNCTION delete_entity_sidecars('tech_skill_category');
--> statement-breakpoint
CREATE TRIGGER tech_skills_delete_sidecars AFTER DELETE ON "tech_skills"
	REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
	EXECUTE FUNCTION delete_entity_sidecars('tech_skill');
--> statement-breakpoint
CREATE TRIGGER side_projects_delete_sidecars AFTER DELETE ON "side_projects"
	REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
	EXECUTE FUNCTION delete_entity_sidecars('side_project');
--> statement-breakpoint
CREATE TRIGGER side_project_achievements_delete_sidecars AFTER DELETE ON "side_project_achievements"
	REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
	EXECUTE FUNCTION delete_entity_sidecars('side_project_achievement');
--> statement-breakpoint
CREATE TRIGGER education_delete_sidecars AFTER DELETE ON "education"
	REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
	EXECUTE FUNCTION delete_entity_sidecars('education');
--> statement-breakpoint
CREATE TRIGGER profile_field_variants_delete_sidecars AFTER DELETE ON "profile_field_variants"
	REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
	EXECUTE FUNCTION delete_entity_sidecars('profile_field_variant');
--> statement-breakpoint
CREATE TRIGGER references_delete_sidecars AFTER DELETE ON "references"
	REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
	EXECUTE FUNCTION delete_entity_sidecars('reference');
--> statement-breakpoint
CREATE TRIGGER languages_delete_sidecars AFTER DELETE ON "languages"
	REFERENCING OLD TABLE AS gone FOR EACH STATEMENT
	EXECUTE FUNCTION delete_entity_sidecars('language');
--> statement-breakpoint
-- What the deletes before this one left behind: 11 overrides and 1
-- translation on dev and on preview, 2026-10-11.
DELETE FROM profile_version_overrides o WHERE
	(o.entity_type = 'work_experience' AND NOT EXISTS (SELECT 1 FROM "work_experiences" x WHERE x.id = o.entity_id))
	OR (o.entity_type = 'work_experience_achievement' AND NOT EXISTS (SELECT 1 FROM "work_experience_achievements" x WHERE x.id = o.entity_id))
	OR (o.entity_type = 'work_experience_technology' AND NOT EXISTS (SELECT 1 FROM "work_experience_technologies" x WHERE x.id = o.entity_id))
	OR (o.entity_type = 'work_experience_project' AND NOT EXISTS (SELECT 1 FROM "work_experience_projects" x WHERE x.id = o.entity_id))
	OR (o.entity_type = 'tech_skill_category' AND NOT EXISTS (SELECT 1 FROM "tech_skill_categories" x WHERE x.id = o.entity_id))
	OR (o.entity_type = 'tech_skill' AND NOT EXISTS (SELECT 1 FROM "tech_skills" x WHERE x.id = o.entity_id))
	OR (o.entity_type = 'side_project' AND NOT EXISTS (SELECT 1 FROM "side_projects" x WHERE x.id = o.entity_id))
	OR (o.entity_type = 'side_project_achievement' AND NOT EXISTS (SELECT 1 FROM "side_project_achievements" x WHERE x.id = o.entity_id))
	OR (o.entity_type = 'education' AND NOT EXISTS (SELECT 1 FROM "education" x WHERE x.id = o.entity_id))
	OR (o.entity_type = 'profile_field_variant' AND NOT EXISTS (SELECT 1 FROM "profile_field_variants" x WHERE x.id = o.entity_id))
	OR (o.entity_type = 'reference' AND NOT EXISTS (SELECT 1 FROM "references" x WHERE x.id = o.entity_id))
	OR (o.entity_type = 'language' AND NOT EXISTS (SELECT 1 FROM "languages" x WHERE x.id = o.entity_id));
--> statement-breakpoint
DELETE FROM profile_translations t WHERE
	(t.entity_type = 'work_experience' AND NOT EXISTS (SELECT 1 FROM "work_experiences" x WHERE x.id = t.entity_id))
	OR (t.entity_type = 'work_experience_achievement' AND NOT EXISTS (SELECT 1 FROM "work_experience_achievements" x WHERE x.id = t.entity_id))
	OR (t.entity_type = 'work_experience_technology' AND NOT EXISTS (SELECT 1 FROM "work_experience_technologies" x WHERE x.id = t.entity_id))
	OR (t.entity_type = 'work_experience_project' AND NOT EXISTS (SELECT 1 FROM "work_experience_projects" x WHERE x.id = t.entity_id))
	OR (t.entity_type = 'tech_skill_category' AND NOT EXISTS (SELECT 1 FROM "tech_skill_categories" x WHERE x.id = t.entity_id))
	OR (t.entity_type = 'tech_skill' AND NOT EXISTS (SELECT 1 FROM "tech_skills" x WHERE x.id = t.entity_id))
	OR (t.entity_type = 'side_project' AND NOT EXISTS (SELECT 1 FROM "side_projects" x WHERE x.id = t.entity_id))
	OR (t.entity_type = 'side_project_achievement' AND NOT EXISTS (SELECT 1 FROM "side_project_achievements" x WHERE x.id = t.entity_id))
	OR (t.entity_type = 'education' AND NOT EXISTS (SELECT 1 FROM "education" x WHERE x.id = t.entity_id))
	OR (t.entity_type = 'profile_field_variant' AND NOT EXISTS (SELECT 1 FROM "profile_field_variants" x WHERE x.id = t.entity_id))
	OR (t.entity_type = 'reference' AND NOT EXISTS (SELECT 1 FROM "references" x WHERE x.id = t.entity_id))
	OR (t.entity_type = 'language' AND NOT EXISTS (SELECT 1 FROM "languages" x WHERE x.id = t.entity_id));
