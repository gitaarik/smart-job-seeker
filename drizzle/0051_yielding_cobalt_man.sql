CREATE TABLE "resume_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"status" varchar(255) DEFAULT 'published' NOT NULL,
	"sort" integer,
	"config" jsonb,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "resume_templates" ADD CONSTRAINT "resume_templates_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;