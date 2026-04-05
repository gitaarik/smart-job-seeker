CREATE TABLE "user_feedback" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL,
  "profile_id" integer,
  "category" varchar(50) NOT NULL DEFAULT 'other',
  "message" text NOT NULL,
  "page_url" varchar(1000),
  "status" varchar(50) NOT NULL DEFAULT 'new',
  "admin_note" text,
  "date_created" timestamptz(6) DEFAULT now(),
  "date_updated" timestamptz(6)
);

CREATE TABLE "user_feedback_files" (
  "id" serial PRIMARY KEY,
  "user_feedback_id" integer NOT NULL REFERENCES "user_feedback"("id") ON DELETE CASCADE,
  "directus_files_id" uuid NOT NULL REFERENCES "directus_files"("id") ON DELETE CASCADE
);

CREATE INDEX "user_feedback_user_id_idx" ON "user_feedback"("user_id");
CREATE INDEX "user_feedback_status_idx" ON "user_feedback"("status");
CREATE INDEX "user_feedback_category_idx" ON "user_feedback"("category");
CREATE INDEX "user_feedback_date_created_idx" ON "user_feedback"("date_created");
CREATE INDEX "user_feedback_files_feedback_idx" ON "user_feedback_files"("user_feedback_id");
