-- Stop storing the recommendation word, and keep only what the score cannot say.
--
-- The word a match shows (highly recommend, recommend, consider, not
-- recommended) is read off its score now, in $lib/match-recommendation.ts. The
-- model used to choose it and it was stored next to the score, and the two
-- disagreed: on preview a stored "consider" ran from 4 to 98. So the column
-- goes, and with it the model's old choices, which nothing reads any more.
--
-- Two of its values were never a word. `ineligible` and `filtered_out` mark a
-- job that failed the eligibility check before any model saw it, and its score
-- of 0 is one a real score can have too. They move to `skip_reason`, on the
-- match and on its history, before the old column is dropped.
ALTER TABLE "job_match_history" ADD COLUMN "skip_reason" varchar(32);--> statement-breakpoint
ALTER TABLE "job_matches" ADD COLUMN "skip_reason" varchar(32);--> statement-breakpoint
UPDATE "job_match_history" SET "skip_reason" = "recommendation" WHERE "recommendation" IN ('ineligible', 'filtered_out');--> statement-breakpoint
UPDATE "job_matches" SET "skip_reason" = "recommendation" WHERE "recommendation" IN ('ineligible', 'filtered_out');--> statement-breakpoint
ALTER TABLE "job_match_history" DROP COLUMN "recommendation";--> statement-breakpoint
ALTER TABLE "job_matches" DROP COLUMN "recommendation";
