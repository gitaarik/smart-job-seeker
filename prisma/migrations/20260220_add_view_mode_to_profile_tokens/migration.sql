-- Add view_mode column to profile_tokens (html or pdf)
ALTER TABLE "profile_tokens" ADD COLUMN "view_mode" VARCHAR(10) NOT NULL DEFAULT 'html';
