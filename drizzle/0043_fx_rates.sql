CREATE TABLE "fx_rates" (
	"id" integer PRIMARY KEY NOT NULL,
	"base" varchar(10) DEFAULT 'EUR' NOT NULL,
	"rates" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
-- Cold-start seed so the row always exists from deploy; the worker's FX refresh
-- job overwrites this with live rates on its first run. Not a runtime fallback.
INSERT INTO "fx_rates" ("id", "base", "rates", "updated_at")
VALUES (1, 'EUR', '{"EUR":1,"USD":1.08,"GBP":0.86}'::jsonb, now())
ON CONFLICT ("id") DO NOTHING;
