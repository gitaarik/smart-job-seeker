CREATE TABLE "letter_versions" (
  "id" SERIAL PRIMARY KEY,
  "date_created" TIMESTAMPTZ(6) DEFAULT NOW(),
  "letter" INT NOT NULL,
  "content" TEXT,
  "source" VARCHAR(255) NOT NULL,
  "ai_chat" INT,
  "ai_feedback" TEXT,
  CONSTRAINT "letter_versions_letter_foreign" FOREIGN KEY ("letter") REFERENCES "application_letters" ("id") ON DELETE CASCADE,
  CONSTRAINT "letter_versions_ai_chat_foreign" FOREIGN KEY ("ai_chat") REFERENCES "ai_chats" ("id") ON DELETE SET NULL
);
