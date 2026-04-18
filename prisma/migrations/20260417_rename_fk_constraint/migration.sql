-- Rename legacy FK constraint
ALTER TABLE "applications_files"
  RENAME CONSTRAINT "applications_files_directus_files_id_foreign"
  TO "applications_files_file_id_foreign";
