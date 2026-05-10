CREATE TABLE "job_platform_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform_id" integer NOT NULL,
	"field" varchar(64) NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_by_user_id" text
);
--> statement-breakpoint
ALTER TABLE "job_platform_changes" ADD CONSTRAINT "job_platform_changes_platform_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."job_platforms"("id") ON DELETE cascade ON UPDATE no action;