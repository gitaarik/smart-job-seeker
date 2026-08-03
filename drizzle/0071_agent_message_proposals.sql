ALTER TABLE "agent_messages" ADD COLUMN "proposal" jsonb;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD COLUMN "proposal_applied_at" timestamp with time zone;