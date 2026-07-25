CREATE TABLE "profile_document_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"path" varchar(1024),
	"ext" varchar(32),
	"extracted_text" text,
	"chars" integer DEFAULT 0 NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "profile_document_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"work_experience_id" integer,
	"work_experience_project_id" integer,
	"side_project_id" integer,
	"file_id" uuid,
	"kind" varchar(16) DEFAULT 'file' NOT NULL,
	"title" varchar(255),
	"original_filename" varchar(512),
	"summary" text,
	"keywords" json,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"extraction_error" text,
	"skipped" json,
	"file_count" integer DEFAULT 0 NOT NULL,
	"total_chars" integer DEFAULT 0 NOT NULL,
	"total_bytes" integer DEFAULT 0 NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profile_document_files" ADD CONSTRAINT "profile_document_files_project_foreign" FOREIGN KEY ("project_id") REFERENCES "public"."profile_document_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_document_projects" ADD CONSTRAINT "profile_document_projects_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_document_projects" ADD CONSTRAINT "profile_document_projects_work_experience_foreign" FOREIGN KEY ("work_experience_id") REFERENCES "public"."work_experiences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_document_projects" ADD CONSTRAINT "profile_document_projects_work_experience_project_foreign" FOREIGN KEY ("work_experience_project_id") REFERENCES "public"."work_experience_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_document_projects" ADD CONSTRAINT "profile_document_projects_side_project_foreign" FOREIGN KEY ("side_project_id") REFERENCES "public"."side_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_document_projects" ADD CONSTRAINT "profile_document_projects_file_foreign" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_document_files_project_idx" ON "profile_document_files" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "profile_document_projects_profile_idx" ON "profile_document_projects" USING btree ("profile_id");