CREATE TABLE "profile_version_skill_words" (
	"id" serial PRIMARY KEY NOT NULL,
	"version_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"reason" text,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profile_version_skill_words" ADD CONSTRAINT "profile_version_skill_words_version_foreign" FOREIGN KEY ("version_id") REFERENCES "public"."profile_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_version_skill_words" ADD CONSTRAINT "profile_version_skill_words_category_foreign" FOREIGN KEY ("category_id") REFERENCES "public"."tech_skill_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_version_skill_words_name_key" ON "profile_version_skill_words" USING btree ("version_id","name");--> statement-breakpoint
CREATE INDEX "profile_version_skill_words_category_idx" ON "profile_version_skill_words" USING btree ("category_id");