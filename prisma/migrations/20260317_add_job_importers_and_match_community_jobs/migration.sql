-- CreateTable
CREATE TABLE "job_importers" (
    "id" SERIAL NOT NULL,
    "job" INTEGER NOT NULL,
    "profile" INTEGER NOT NULL,
    "date_created" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_importers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_importers_job_profile_unique" ON "job_importers"("job", "profile");

-- AddForeignKey
ALTER TABLE "job_importers" ADD CONSTRAINT "job_importers_job_foreign" FOREIGN KEY ("job") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "job_importers" ADD CONSTRAINT "job_importers_profile_foreign" FOREIGN KEY ("profile") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AlterTable
ALTER TABLE "match_config" ADD COLUMN "match_community_jobs" BOOLEAN NOT NULL DEFAULT false;
