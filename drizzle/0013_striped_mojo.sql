CREATE TABLE "capability_edits" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"source" varchar(16) NOT NULL,
	"capability" varchar(64) NOT NULL,
	"target" jsonb NOT NULL,
	"fields" jsonb NOT NULL,
	"previous" jsonb NOT NULL,
	"reverted_at" timestamp with time zone,
	"date_created" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capability_edits" ADD CONSTRAINT "capability_edits_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capability_edits_profile_idx" ON "capability_edits" USING btree ("profile_id","date_created");