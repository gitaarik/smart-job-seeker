CREATE TABLE "certificate_skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"name" varchar(255),
	"certificate_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "expiry_date" date;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "credential_id" varchar(255);--> statement-breakpoint
ALTER TABLE "certificate_skills" ADD CONSTRAINT "certificate_skills_certificate_foreign" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certificate_skills_certificate_idx" ON "certificate_skills" USING btree ("certificate_id");