ALTER TABLE "ai_chats" ADD COLUMN "observation_id" varchar(16);--> statement-breakpoint
ALTER TABLE "capability_edits" ADD COLUMN "proposal_id" integer;--> statement-breakpoint
ALTER TABLE "capability_edits" ADD CONSTRAINT "capability_edits_proposal_foreign" FOREIGN KEY ("proposal_id") REFERENCES "public"."agent_message_proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capability_edits_proposal_idx" ON "capability_edits" USING btree ("proposal_id");