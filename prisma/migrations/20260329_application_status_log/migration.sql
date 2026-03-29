-- CreateTable
CREATE TABLE "application_status_log" (
    "id" SERIAL NOT NULL,
    "date_created" TIMESTAMPTZ(6),
    "application" INTEGER NOT NULL,
    "from_status" VARCHAR(255),
    "to_status" VARCHAR(255) NOT NULL,
    "description" TEXT,

    CONSTRAINT "application_status_log_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "application_status_log" ADD CONSTRAINT "application_status_log_application_foreign" FOREIGN KEY ("application") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- CreateIndex
CREATE INDEX "application_status_log_application_idx" ON "application_status_log"("application");

-- Migrate existing activity log entries to status log
INSERT INTO "application_status_log" ("date_created", "application", "from_status", "to_status", "description")
SELECT
    date_created,
    application,
    NULL,
    CASE
        WHEN title LIKE 'Status changed to%' THEN
            CASE
                WHEN title LIKE '%Applied%' THEN 'sent'
                WHEN title LIKE '%Interviewing%' THEN 'interviewing'
                WHEN title LIKE '%Offered%' THEN 'offered'
                WHEN title LIKE '%Accepted%' THEN 'accepted'
                WHEN title LIKE '%Not Selected%' THEN 'rejected'
                WHEN title LIKE '%Discontinued%' THEN 'withdrawn'
                WHEN title LIKE '%Preparing%' THEN 'preparing'
                ELSE 'draft'
            END
        WHEN title = 'Application created' THEN 'draft'
        ELSE 'draft'
    END,
    CASE
        WHEN title NOT LIKE 'Status changed to%' AND title != 'Application created' THEN
            COALESCE(title, '') || CASE WHEN note IS NOT NULL AND note != '' THEN E'\n' || note ELSE '' END
        WHEN note IS NOT NULL AND note != '' THEN note
        ELSE NULL
    END
FROM "application_activity_log"
WHERE application IS NOT NULL
ORDER BY date_created;
