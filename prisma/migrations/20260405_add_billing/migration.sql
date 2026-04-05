-- Billing customers (links users to Stripe)
CREATE TABLE "billing_customers" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "stripe_customer_id" varchar(255) NOT NULL UNIQUE,
  "date_created" timestamptz(6) DEFAULT now()
);

-- Subscriptions
CREATE TABLE "subscriptions" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "stripe_subscription_id" varchar(255) NOT NULL UNIQUE,
  "stripe_price_id" varchar(255) NOT NULL,
  "plan" varchar(50) NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'active',
  "current_period_start" timestamptz(6) NOT NULL,
  "current_period_end" timestamptz(6) NOT NULL,
  "cancel_at_period_end" boolean NOT NULL DEFAULT false,
  "date_created" timestamptz(6) DEFAULT now(),
  "date_updated" timestamptz(6)
);
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- Credit purchases
CREATE TABLE "credit_purchases" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "stripe_payment_intent_id" varchar(255),
  "pack_type" varchar(50) NOT NULL,
  "amount_cents" integer NOT NULL,
  "period" varchar(7) NOT NULL,
  "date_created" timestamptz(6) DEFAULT now()
);
CREATE INDEX "credit_purchases_user_id_idx" ON "credit_purchases"("user_id");

-- Usage counters (per user per month)
CREATE TABLE "usage_counters" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "period" varchar(7) NOT NULL,
  "ai_generations" integer NOT NULL DEFAULT 0,
  "ai_followups" integer NOT NULL DEFAULT 0,
  "job_matches" integer NOT NULL DEFAULT 0,
  "scrape_runs" integer NOT NULL DEFAULT 0,
  "pdf_exports" integer NOT NULL DEFAULT 0,
  "resume_parses" integer NOT NULL DEFAULT 0,
  "extra_ai_generations" integer NOT NULL DEFAULT 0,
  "extra_ai_followups" integer NOT NULL DEFAULT 0,
  "extra_job_matches" integer NOT NULL DEFAULT 0,
  "extra_scrape_runs" integer NOT NULL DEFAULT 0,
  UNIQUE("user_id", "period")
);
CREATE INDEX "usage_counters_user_id_idx" ON "usage_counters"("user_id");
CREATE INDEX "usage_counters_period_idx" ON "usage_counters"("period");
