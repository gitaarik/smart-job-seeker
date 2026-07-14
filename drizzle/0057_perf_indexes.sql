CREATE INDEX IF NOT EXISTS "agent_messages_ai_chat_id_idx" ON "agent_messages" USING btree ("ai_chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_chats_profile_id_idx" ON "ai_chats" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_chats_followup_to_idx" ON "ai_chats" USING btree ("followup_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_chats_request_type_idx" ON "ai_chats" USING btree ("request_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_chats_date_created_idx" ON "ai_chats" USING btree ("date_created");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_letters_ai_chat_id_idx" ON "application_letters" USING btree ("ai_chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_questions_ai_chat_id_idx" ON "application_questions" USING btree ("ai_chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_profile_status_updated_idx" ON "applications" USING btree ("profile_id","status","date_updated" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collected_data_profile_updated_idx" ON "collected_data" USING btree ("profile_id","date_updated" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_importers_profile_job_idx" ON "job_importers" USING btree ("profile_id","job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_matches_ai_chat_scoring_idx" ON "job_matches" USING btree ("ai_chat_scoring");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_matches_profile_score_idx" ON "job_matches" USING btree ("profile_id","score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_ai_chat_extraction_idx" ON "jobs" USING btree ("ai_chat_extraction");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_date_posted_idx" ON "jobs" USING btree ("date_posted" DESC NULLS LAST,"date_created" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "letter_versions_ai_chat_idx" ON "letter_versions" USING btree ("ai_chat");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_config_profile_id_idx" ON "match_config" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_logs_timestamp_idx" ON "scraper_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_task_runs_active_idx" ON "search_task_runs" USING btree ("started_at") WHERE status IN ('stopping','queued','running','blocked');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_tasks_next_run_idx" ON "search_tasks" USING btree ("next_scheduled_run") WHERE is_active AND schedule_interval_hours IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tech_skill_categories_profile_idx" ON "tech_skill_categories" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tech_skills_category_idx" ON "tech_skills" USING btree ("category_id");