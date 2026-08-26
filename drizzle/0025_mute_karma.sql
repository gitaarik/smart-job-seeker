ALTER TABLE "skill_aliases" ADD COLUMN "source" varchar(32) DEFAULT 'llm' NOT NULL;--> statement-breakpoint
ALTER TABLE "skill_aliases" ADD COLUMN "approved_at" timestamp with time zone;