-- Migrate application statuses: merge "preparing" and "sent" into "applying"
UPDATE "applications" SET "status" = 'applying' WHERE "status" IN ('preparing', 'sent');

-- Migrate status log entries
UPDATE "application_status_log" SET "from_status" = 'applying' WHERE "from_status" IN ('preparing', 'sent');
UPDATE "application_status_log" SET "to_status" = 'applying' WHERE "to_status" IN ('preparing', 'sent');

-- Set step for migrated rows that were "preparing" (had no step, only actions)
UPDATE "applications" SET "status_step" = 'Preparing'
  WHERE "status" = 'applying' AND "status_step" IS NULL
  AND ("status_action" IS NULL OR "status_action" IN ('Send application', 'Tailor Resume/CV', 'Write cover letter', 'Complete platform profile'));

-- Migrate old "sent" phase steps to new specific statuses
UPDATE "applications" SET "status_step" = 'Applied through job platform'
  WHERE "status" = 'applying' AND "status_step" = 'Job board message sent';
UPDATE "applications" SET "status_step" = 'Application form completed'
  WHERE "status" = 'applying' AND "status_step" = 'Application form completed';
UPDATE "applications" SET "status_step" = 'E-mail sent'
  WHERE "status" = 'applying' AND "status_step" = 'E-mail sent';
UPDATE "applications" SET "status_step" = 'Resume / CV submitted'
  WHERE "status" = 'applying' AND "status_step" = 'Resume / CV sent';

-- Applications that were "sent" with "Awaiting response" action and no recognized step
UPDATE "applications" SET "status_step" = 'Applied through job platform'
  WHERE "status" = 'applying' AND "status_step" IS NULL AND "status_action" = 'Awaiting response';

-- Migrate any existing "Awaiting response" step
UPDATE "applications" SET "status_step" = 'Applied through job platform'
  WHERE "status_step" = 'Awaiting response';
