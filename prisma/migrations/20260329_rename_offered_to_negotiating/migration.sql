-- Rename "offered" status to "negotiating"
UPDATE "applications" SET "status" = 'negotiating' WHERE "status" = 'offered';
UPDATE "application_status_log" SET "from_status" = 'negotiating' WHERE "from_status" = 'offered';
UPDATE "application_status_log" SET "to_status" = 'negotiating' WHERE "to_status" = 'offered';
