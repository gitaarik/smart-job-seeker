-- Widen period column from YYYY-MM (7 chars) to YYYY-MM-DD (10 chars)
ALTER TABLE "credit_balances" ALTER COLUMN "period" TYPE varchar(10);
