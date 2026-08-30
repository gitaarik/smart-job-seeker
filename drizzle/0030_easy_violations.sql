ALTER TABLE "skill_relations" ADD COLUMN "date_updated" timestamp with time zone;--> statement-breakpoint
CREATE OR REPLACE FUNCTION skill_relations_touch() RETURNS trigger AS $$
BEGIN
	NEW.date_updated = now();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS skill_relations_touch ON "skill_relations";
--> statement-breakpoint
CREATE TRIGGER skill_relations_touch
	BEFORE UPDATE ON "skill_relations"
	FOR EACH ROW EXECUTE FUNCTION skill_relations_touch();
