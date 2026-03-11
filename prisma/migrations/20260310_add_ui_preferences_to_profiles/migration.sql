ALTER TABLE "profiles" ADD COLUMN "ui_preferences" JSONB DEFAULT '{}';
ALTER TABLE "job_searches" ADD COLUMN "ui_preferences" JSONB DEFAULT '{}';
