DROP INDEX "agent_conversations_user_idx";--> statement-breakpoint
ALTER TABLE "agent_conversations" ALTER COLUMN "profile_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_conversations" ADD CONSTRAINT "agent_conversations_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_conversations_user_profile_idx" ON "agent_conversations" USING btree ("user_id","profile_id","last_message_at" DESC NULLS FIRST);