CREATE TABLE "sent_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"to" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"html" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'sent' NOT NULL,
	"error" text,
	"sent_at" timestamp (6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"user_id" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE INDEX "idx_sent_emails_type" ON "sent_emails" USING btree ("type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_sent_emails_status" ON "sent_emails" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_sent_emails_sent_at" ON "sent_emails" USING btree ("sent_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_sent_emails_user" ON "sent_emails" USING btree ("user_id" text_ops);