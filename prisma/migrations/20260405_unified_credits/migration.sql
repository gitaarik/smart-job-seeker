-- Unified credit system: replace per-feature counters with a single credit balance + transaction log

-- Credit balances per user per billing period
CREATE TABLE "credit_balances" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "period" varchar(7) NOT NULL,
  "credits_used" integer NOT NULL DEFAULT 0,
  "credits_allowance" integer NOT NULL DEFAULT 0,
  "extra_credits" integer NOT NULL DEFAULT 0,
  UNIQUE("user_id", "period")
);

CREATE INDEX "credit_balances_user_id_idx" ON "credit_balances"("user_id");

-- Credit transaction log for transparency and auditing
CREATE TABLE "credit_transactions" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" integer NOT NULL,
  "balance_after" integer,
  "operation" varchar(100) NOT NULL,
  "description" text,
  "metadata" jsonb,
  "created_at" timestamptz(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX "credit_transactions_user_id_created_idx" ON "credit_transactions"("user_id", "created_at");
CREATE INDEX "credit_transactions_operation_idx" ON "credit_transactions"("operation");

-- Add token tracking to ai_chats
ALTER TABLE "ai_chats" ADD COLUMN "input_tokens" integer;
ALTER TABLE "ai_chats" ADD COLUMN "output_tokens" integer;
ALTER TABLE "ai_chats" ADD COLUMN "total_tokens" integer;
ALTER TABLE "ai_chats" ADD COLUMN "credits_charged" integer;
