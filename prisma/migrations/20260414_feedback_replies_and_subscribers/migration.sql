-- Add merged_into_id for ticket merging
ALTER TABLE "user_feedback" ADD COLUMN "merged_into_id" integer REFERENCES "user_feedback"("id") ON DELETE SET NULL;
CREATE INDEX "user_feedback_merged_into_idx" ON "user_feedback"("merged_into_id");

-- Feedback replies (conversation thread)
CREATE TABLE "feedback_replies" (
  "id" serial PRIMARY KEY,
  "feedback_id" integer NOT NULL REFERENCES "user_feedback"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "is_admin" boolean NOT NULL DEFAULT false,
  "message" text NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX "feedback_replies_feedback_idx" ON "feedback_replies"("feedback_id");

-- Feedback subscribers (for merged tickets)
CREATE TABLE "user_feedback_subscribers" (
  "id" serial PRIMARY KEY,
  "feedback_id" integer NOT NULL REFERENCES "user_feedback"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "subscribed_at" timestamptz(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "user_feedback_subscribers_unique" ON "user_feedback_subscribers"("feedback_id", "user_id");
CREATE INDEX "user_feedback_subscribers_user_idx" ON "user_feedback_subscribers"("user_id");
