CREATE TABLE "profile_version_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"version_id" integer NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" integer NOT NULL,
	"action" varchar(16) NOT NULL,
	"sort" integer,
	"reason" text,
	"source" varchar(16) DEFAULT 'ai' NOT NULL,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profile_versions" ADD COLUMN "application_id" integer;--> statement-breakpoint
ALTER TABLE "profile_version_overrides" ADD CONSTRAINT "profile_version_overrides_version_foreign" FOREIGN KEY ("version_id") REFERENCES "public"."profile_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_version_overrides_item_key" ON "profile_version_overrides" USING btree ("version_id","entity_type","entity_id");--> statement-breakpoint
ALTER TABLE "profile_versions" ADD CONSTRAINT "profile_versions_application_foreign" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_versions_application_idx" ON "profile_versions" USING btree ("application_id");