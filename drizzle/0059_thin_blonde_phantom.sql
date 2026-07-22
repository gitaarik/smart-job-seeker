CREATE TABLE "question_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp (6) with time zone DEFAULT now(),
	"question" integer NOT NULL,
	"content" text,
	"source" varchar(255) NOT NULL,
	"ai_chat" integer,
	"ai_feedback" text,
	"user_request" text
);
--> statement-breakpoint
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_ai_chat_foreign" FOREIGN KEY ("ai_chat") REFERENCES "public"."ai_chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_question_foreign" FOREIGN KEY ("question") REFERENCES "public"."application_questions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "question_versions_ai_chat_idx" ON "question_versions" USING btree ("ai_chat");