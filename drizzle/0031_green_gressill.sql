CREATE INDEX "applications_cv_file_sent_idx" ON "applications" USING btree ("cv_file_sent_id");--> statement-breakpoint
CREATE INDEX "education_logo_idx" ON "education" USING btree ("logo_id");--> statement-breakpoint
CREATE INDEX "job_resources_file_idx" ON "job_resources" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "profile_document_projects_file_idx" ON "profile_document_projects" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "profile_exports_file_idx" ON "profile_exports" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "profiles_profile_picture_idx" ON "profiles" USING btree ("profile_picture_id");--> statement-breakpoint
CREATE INDEX "user_feedback_files_file_idx" ON "user_feedback_files" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "work_experiences_logo_idx" ON "work_experiences" USING btree ("logo_id");