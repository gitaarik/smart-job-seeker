CREATE TABLE "legal_acceptances" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"document" varchar(32) NOT NULL,
	"version" varchar(32) NOT NULL,
	"accepted_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"detail" jsonb
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" timestamp (6) with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_version" varchar(32);--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_user_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "legal_acceptances_user_idx" ON "legal_acceptances" USING btree ("user_id");