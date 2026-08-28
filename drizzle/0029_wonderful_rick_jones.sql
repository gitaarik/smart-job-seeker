CREATE TABLE "profile_template_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" integer NOT NULL,
	"field" varchar(64) NOT NULL,
	"locale" varchar(16) DEFAULT 'en' NOT NULL,
	"value" text NOT NULL,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profile_template_overrides" ADD CONSTRAINT "profile_template_overrides_template_foreign" FOREIGN KEY ("template_id") REFERENCES "public"."resume_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_template_overrides_key" ON "profile_template_overrides" USING btree ("template_id","entity_type","entity_id","field","locale");--> statement-breakpoint
CREATE INDEX "profile_template_overrides_lookup" ON "profile_template_overrides" USING btree ("template_id","locale");