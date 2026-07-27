CREATE TABLE "application_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"record_type" varchar(50) DEFAULT 'interview_recap' NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text,
	"event_date" date,
	"step" varchar(255),
	"status_log" integer,
	"sort" integer,
	"date_created" timestamp (6) with time zone DEFAULT now(),
	"date_updated" timestamp (6) with time zone
);
--> statement-breakpoint
ALTER TABLE "application_records" ADD CONSTRAINT "application_records_application_foreign" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_records" ADD CONSTRAINT "application_records_status_log_foreign" FOREIGN KEY ("status_log") REFERENCES "public"."application_status_log"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_records_application_idx" ON "application_records" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_records_status_log_idx" ON "application_records" USING btree ("status_log");