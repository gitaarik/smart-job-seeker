-- Per-search browser provider selection: "hosted" (GoLogin) or "local" (desktop tunnel)
-- NULL means use server default (SJS_BROWSER_PROVIDER env var)
ALTER TABLE "job_searches" ADD COLUMN "browser_provider" VARCHAR(20);
