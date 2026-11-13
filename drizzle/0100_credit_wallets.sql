CREATE TABLE "credit_wallets" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_wallets_balance_check" CHECK ("credit_wallets"."balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
-- Carry every period's unspent purchased credits into the wallet. The old
-- balance spent allowance + extra as one pool, so overflow past the allowance
-- is what came out of the extras.
INSERT INTO "credit_wallets" ("user_id", "balance")
SELECT "user_id", SUM(GREATEST(0, "extra_credits" - GREATEST(0, "credits_used" - "credits_allowance")))
FROM "credit_balances"
WHERE "extra_credits" > 0
GROUP BY "user_id";--> statement-breakpoint
ALTER TABLE "credit_balances" DROP COLUMN "extra_credits";