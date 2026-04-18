-- Rename legacy directus_files_id columns to file_id
ALTER TABLE "applications_files" RENAME COLUMN "directus_files_id" TO "file_id";
ALTER TABLE "user_feedback_files" RENAME COLUMN "directus_files_id" TO "file_id";
