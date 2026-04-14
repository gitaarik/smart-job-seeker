CREATE TABLE "notifications" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL,
  "type" varchar(50) NOT NULL,
  "title" varchar(200) NOT NULL,
  "message" text,
  "link" varchar(500),
  "read_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");
CREATE INDEX "notifications_user_unread_idx" ON "notifications"("user_id", "read_at") WHERE "read_at" IS NULL;
