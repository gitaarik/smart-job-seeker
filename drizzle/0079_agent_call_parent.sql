ALTER TABLE "ai_chats" ADD COLUMN "parent_id" integer;--> statement-breakpoint
ALTER TABLE "ai_chats" ADD CONSTRAINT "ai_chats_parent_id_foreign" FOREIGN KEY ("parent_id") REFERENCES "public"."ai_chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_chats_parent_id_idx" ON "ai_chats" USING btree ("parent_id");