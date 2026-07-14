CREATE TABLE "profile_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" integer NOT NULL,
	"field" varchar(64) NOT NULL,
	"locale" varchar(16) NOT NULL,
	"value" text NOT NULL,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profile_translations" ADD CONSTRAINT "profile_translations_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_translations_key" ON "profile_translations" USING btree ("entity_type","entity_id","field","locale");--> statement-breakpoint
CREATE INDEX "profile_translations_lookup" ON "profile_translations" USING btree ("profile_id","locale");