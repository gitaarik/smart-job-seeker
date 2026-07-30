CREATE TABLE "cheat_sheet_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp (6) with time zone DEFAULT now(),
	"cheat_sheet" integer NOT NULL,
	"content" text,
	"source" varchar(255) NOT NULL,
	"ai_chat" integer,
	"ai_feedback" text,
	"user_request" text
);
--> statement-breakpoint
ALTER TABLE "cheat_sheets" ADD COLUMN "ai_chat_id" integer;--> statement-breakpoint
ALTER TABLE "cheat_sheets" ADD COLUMN "ai_chat_response" text;--> statement-breakpoint
ALTER TABLE "cheat_sheet_versions" ADD CONSTRAINT "cheat_sheet_versions_ai_chat_foreign" FOREIGN KEY ("ai_chat") REFERENCES "public"."ai_chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheat_sheet_versions" ADD CONSTRAINT "cheat_sheet_versions_cheat_sheet_foreign" FOREIGN KEY ("cheat_sheet") REFERENCES "public"."cheat_sheets"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "cheat_sheet_versions_ai_chat_idx" ON "cheat_sheet_versions" USING btree ("ai_chat");--> statement-breakpoint
CREATE INDEX "cheat_sheet_versions_cheat_sheet_idx" ON "cheat_sheet_versions" USING btree ("cheat_sheet");--> statement-breakpoint
ALTER TABLE "cheat_sheets" ADD CONSTRAINT "cheat_sheets_ai_chat_foreign" FOREIGN KEY ("ai_chat_id") REFERENCES "public"."ai_chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cheat_sheets_ai_chat_id_idx" ON "cheat_sheets" USING btree ("ai_chat_id");