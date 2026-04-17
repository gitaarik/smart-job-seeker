-- Column renames: add _id suffix to foreign key columns
-- Run this on preview/production BEFORE deploying the new code
--
-- Usage:
--   psql -U postgres -d smartjobseeker -f scripts/migrate-column-renames.sql
--
-- Safe to run multiple times: uses DO block to skip already-renamed columns

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Array of (table, old_column, new_column) renames
  FOR r IN
    SELECT * FROM (VALUES
      ('ai_chats', 'profile', 'profile_id'),
      ('api_keys', 'profile', 'profile_id'),
      ('application_activity_log', 'application', 'application_id'),
      ('application_letters', 'ai_chat', 'ai_chat_id'),
      ('application_letters', 'application', 'application_id'),
      ('application_questions', 'ai_chat', 'ai_chat_id'),
      ('application_questions', 'application', 'application_id'),
      ('applications', 'cv_file_sent', 'cv_file_sent_id'),
      ('applications', 'job', 'job_id'),
      ('applications', 'profile', 'profile_id'),
      ('cheat_sheets', 'profile', 'profile_id'),
      ('collected_data', 'profile', 'profile_id'),
      ('contacts', 'recipient', 'recipient_id'),
      ('contacts', 'requester', 'requester_id'),
      ('device_shares', 'api_key', 'api_key_id'),
      ('education', 'logo', 'logo_id'),
      ('education', 'profile', 'profile_id'),
      ('highlights', 'profile', 'profile_id'),
      ('job_matches', 'job', 'job_id'),
      ('job_matches', 'profile', 'profile_id'),
      ('job_resources', 'file', 'file_id'),
      ('job_resources', 'job', 'job_id'),
      ('jobs', 'job_platform', 'job_platform_id'),
      ('languages', 'profile', 'profile_id'),
      ('match_config', 'profile', 'profile_id'),
      ('os_contributions', 'profile', 'profile_id'),
      ('platform_profiles', 'platform', 'platform_id'),
      ('platform_profiles', 'profile', 'profile_id'),
      ('profile_exports', 'file', 'file_id'),
      ('profile_exports', 'profile', 'profile_id'),
      ('profile_version_extensions', 'extended', 'extended_id'),
      ('profile_version_extensions', 'extender', 'extender_id'),
      ('profile_versions', 'profile', 'profile_id'),
      ('profiles', 'profile_picture', 'profile_picture_id'),
      ('profiles', 'public_cv_version', 'public_cv_version_id'),
      ('profiles', 'public_resume_version', 'public_resume_version_id'),
      ('project_stories', 'profile', 'profile_id'),
      ('"references"', 'profile', 'profile_id'),
      ('salary_expectations', 'profile', 'profile_id'),
      ('scraper_agent_iterations', 'session', 'session_id'),
      ('search_tasks', 'platform', 'platform_id'),
      ('search_tasks', 'profile', 'profile_id'),
      ('side_project_achievements', 'side_project', 'side_project_id'),
      ('side_project_technologies', 'side_project', 'side_project_id'),
      ('side_projects', 'profile', 'profile_id'),
      ('tech_skill_categories', 'profile', 'profile_id'),
      ('tech_skills', 'category', 'category_id'),
      ('tech_skills', 'tech_type', 'tech_type_id'),
      ('verification_email_addresses', 'profile', 'profile_id'),
      ('work_experience_achievements', 'work_experience', 'work_experience_id'),
      ('work_experience_project_technologies', 'work_experience_project', 'work_experience_project_id'),
      ('work_experience_projects', 'work_experience', 'work_experience_id'),
      ('work_experience_technologies', 'work_experience', 'work_experience_id'),
      ('work_experiences', 'logo', 'logo_id'),
      ('work_experiences', 'profile', 'profile_id')
    ) AS t(tbl, old_col, new_col)
  LOOP
    -- Only rename if old column exists (makes script idempotent)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = replace(r.tbl, '"', '')
        AND column_name = r.old_col
    ) THEN
      EXECUTE format('ALTER TABLE %s RENAME COLUMN %I TO %I', r.tbl, r.old_col, r.new_col);
      RAISE NOTICE 'Renamed %.% → %', r.tbl, r.old_col, r.new_col;
    ELSE
      RAISE NOTICE 'Skipped %.% (already renamed or missing)', r.tbl, r.old_col;
    END IF;
  END LOOP;
END $$;
