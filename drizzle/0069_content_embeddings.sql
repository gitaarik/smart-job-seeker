CREATE TABLE "content_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"unit_type" varchar(32) NOT NULL,
	"unit_id" integer NOT NULL,
	"sub_id" integer DEFAULT 0 NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"embedding" jsonb NOT NULL,
	"model" varchar(100) NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_embeddings" ADD CONSTRAINT "content_embeddings_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_embeddings_unit_key" ON "content_embeddings" USING btree ("unit_type","unit_id","sub_id");--> statement-breakpoint
CREATE INDEX "content_embeddings_profile_idx" ON "content_embeddings" USING btree ("profile_id");