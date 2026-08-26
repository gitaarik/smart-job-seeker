ALTER TABLE "skill_aliases" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "skill_relations" ADD COLUMN "rejected_at" timestamp with time zone;