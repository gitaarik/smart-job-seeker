ALTER TABLE "credit_purchases" ADD COLUMN "credits" integer;--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD COLUMN "refunded_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD COLUMN "credits_reversed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill from the grant's own transaction, which carries the payment intent.
UPDATE "credit_purchases" p SET "credits" = t."amount"
FROM "credit_transactions" t
WHERE t."operation" = 'credit_purchase'
	AND t."metadata"->>'stripePaymentIntent' = p."stripe_payment_intent_id"
	AND p."credits" IS NULL;
