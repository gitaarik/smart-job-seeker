-- Drop ai_chat_templates and the ai_chats column that referenced it.
--
-- Prompts moved from this table into prompt-templates.ts on 2026-03-02. Nothing
-- has read it since: `ai_chats.ai_chat_template` was last written 2026-03-02 and
-- is set on 1,297 of 134,808 rows, all from a nine-day window in February.
--
-- `IF EXISTS` on the constraint is not defensive padding — drizzle-kit generates
-- a bare DROP CONSTRAINT here, and it fails. The DROP TABLE above is CASCADE, so
-- Postgres has already removed the foreign key by the time this line runs, and
-- the migration aborts with `constraint "ai_chats_ai_chat_template_foreign" of
-- relation "ai_chats" does not exist`. Same on a from-empty rebuild.
ALTER TABLE "ai_chat_templates" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "ai_chat_templates" CASCADE;--> statement-breakpoint
ALTER TABLE "ai_chats" DROP CONSTRAINT IF EXISTS "ai_chats_ai_chat_template_foreign";
--> statement-breakpoint
ALTER TABLE "ai_chats" DROP COLUMN "ai_chat_template";
