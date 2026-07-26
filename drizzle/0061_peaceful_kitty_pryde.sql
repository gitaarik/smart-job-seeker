CREATE TABLE "project_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"source_type" varchar(16) NOT NULL,
	"project_kind" varchar(32) NOT NULL,
	"project_id" integer NOT NULL,
	"attachment_id" integer DEFAULT 0 NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"embedding" jsonb NOT NULL,
	"model" varchar(100) NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_document_projects" ADD COLUMN "source" jsonb;--> statement-breakpoint
ALTER TABLE "project_embeddings" ADD CONSTRAINT "project_embeddings_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_embeddings_unit_key" ON "project_embeddings" USING btree ("project_kind","project_id","attachment_id");--> statement-breakpoint
CREATE INDEX "project_embeddings_profile_idx" ON "project_embeddings" USING btree ("profile_id");