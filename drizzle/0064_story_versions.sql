CREATE TABLE "story_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp (6) with time zone DEFAULT now(),
	"story" integer NOT NULL,
	"content" text,
	"source" varchar(255) NOT NULL,
	"ai_chat" integer,
	"ai_feedback" text,
	"user_request" text
);
--> statement-breakpoint
ALTER TABLE "project_stories" ADD COLUMN "ai_chat_id" integer;--> statement-breakpoint
ALTER TABLE "project_stories" ADD COLUMN "ai_chat_response" text;--> statement-breakpoint
ALTER TABLE "story_versions" ADD CONSTRAINT "story_versions_ai_chat_foreign" FOREIGN KEY ("ai_chat") REFERENCES "public"."ai_chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_versions" ADD CONSTRAINT "story_versions_story_foreign" FOREIGN KEY ("story") REFERENCES "public"."project_stories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "story_versions_ai_chat_idx" ON "story_versions" USING btree ("ai_chat");--> statement-breakpoint
CREATE INDEX "story_versions_story_idx" ON "story_versions" USING btree ("story");--> statement-breakpoint
ALTER TABLE "project_stories" ADD CONSTRAINT "project_stories_ai_chat_foreign" FOREIGN KEY ("ai_chat_id") REFERENCES "public"."ai_chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_stories_ai_chat_id_idx" ON "project_stories" USING btree ("ai_chat_id");