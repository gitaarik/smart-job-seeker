CREATE TABLE "account_deletions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_ref" varchar(64) NOT NULL,
	"requested_at" timestamp (6) with time zone NOT NULL,
	"completed_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"requested_by" varchar(16) DEFAULT 'user' NOT NULL,
	"profiles_deleted" integer DEFAULT 0 NOT NULL,
	"files_deleted" integer DEFAULT 0 NOT NULL,
	"blobs_unlinked" integer DEFAULT 0 NOT NULL,
	"unlink_failures" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_customers" DROP CONSTRAINT "billing_customers_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "credit_purchases" DROP CONSTRAINT "credit_purchases_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "billing_customers" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_purchases" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD COLUMN "deleted_account_ref" varchar(64);--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD COLUMN "deleted_account_ref" varchar(64);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "deleted_account_ref" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deletion_requested_at" timestamp (6) with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletions_ref_unique" ON "account_deletions" USING btree ("account_ref");--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;