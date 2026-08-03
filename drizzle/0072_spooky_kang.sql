CREATE TABLE "agent_message_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"capability" varchar(64) NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"fields" jsonb NOT NULL,
	"target" jsonb NOT NULL,
	"applied_at" timestamp with time zone,
	"date_created" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_message_proposals" ADD CONSTRAINT "agent_message_proposals_message_foreign" FOREIGN KEY ("message_id") REFERENCES "public"."agent_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_message_proposals_message_idx" ON "agent_message_proposals" USING btree ("message_id");--> statement-breakpoint
-- Hand-added: carry existing proposals across before the columns holding them
-- are dropped. Generated migrations don't move data, and the DROPs below are
-- irreversible — without this, every proposal made under 0071 (and every
-- "Applied" badge on a resumed thread) is lost. A no-op where none exist.
INSERT INTO "agent_message_proposals" ("message_id", "capability", "rationale", "fields", "target", "applied_at", "date_created")
SELECT "id",
       "proposal"->>'capability',
       COALESCE("proposal"->>'rationale', ''),
       COALESCE("proposal"->'fields', '{}'::jsonb),
       "proposal"->'target',
       "proposal_applied_at",
       "date_created"
FROM "agent_messages"
WHERE "proposal" IS NOT NULL
  AND "proposal"->>'capability' IS NOT NULL
  AND "proposal"->'target' IS NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_messages" DROP COLUMN "proposal";--> statement-breakpoint
ALTER TABLE "agent_messages" DROP COLUMN "proposal_applied_at";