CREATE TABLE "profile_directives" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"topic" varchar(64) NOT NULL,
	"statement" text NOT NULL,
	"applies_to" jsonb DEFAULT '["chat"]'::jsonb NOT NULL,
	"stated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"source" jsonb NOT NULL,
	"superseded_by" integer,
	"retired_at" timestamp with time zone,
	"date_created" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"date_updated" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profile_directives" ADD CONSTRAINT "profile_directives_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_directives" ADD CONSTRAINT "profile_directives_superseded_by_foreign" FOREIGN KEY ("superseded_by") REFERENCES "public"."profile_directives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_directives_profile_idx" ON "profile_directives" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_directives_live_topic_idx" ON "profile_directives" USING btree ("profile_id","topic") WHERE superseded_by IS NULL AND retired_at IS NULL;