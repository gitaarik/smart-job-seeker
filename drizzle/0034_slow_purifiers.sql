CREATE TABLE "profile_field_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"field" varchar(64) NOT NULL,
	"label" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"note" text,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profile_field_variants" ADD CONSTRAINT "profile_field_variants_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_field_variants_lookup" ON "profile_field_variants" USING btree ("profile_id","field");