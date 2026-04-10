ALTER TABLE "search_tasks" ADD COLUMN "schedule_interval_hours" INTEGER;
ALTER TABLE "search_tasks" ADD COLUMN "next_scheduled_run" TIMESTAMP(6) WITH TIME ZONE;
