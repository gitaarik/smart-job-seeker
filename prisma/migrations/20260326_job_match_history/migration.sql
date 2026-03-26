-- Job match history: tracks every match/rematch event
CREATE TABLE IF NOT EXISTS "job_match_history" (
    "id" SERIAL PRIMARY KEY,
    "job" INTEGER NOT NULL,
    "profile" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "skill_match_percentage" INTEGER,
    "recommendation" VARCHAR(255),
    "match_summary" TEXT,
    "date_created" TIMESTAMPTZ(6) DEFAULT NOW(),
    CONSTRAINT "job_match_history_job_foreign" FOREIGN KEY ("job") REFERENCES "jobs"("id") ON DELETE CASCADE,
    CONSTRAINT "job_match_history_profile_foreign" FOREIGN KEY ("profile") REFERENCES "profiles"("id") ON DELETE CASCADE
);

CREATE INDEX "job_match_history_profile_job_idx" ON "job_match_history"("profile", "job");
CREATE INDEX "job_match_history_date_idx" ON "job_match_history"("job", "date_created" DESC);
