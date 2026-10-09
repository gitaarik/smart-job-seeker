-- Whether a job pays what the profile asks, and whether to hide it when not.
--
-- The matcher never sees pay, so a perfect skill fit at a third of someone's
-- rate ranks at the top of their list. `job_matches.pay_ratio` is the top of the
-- job's posted pay as a share of the Salary Prep ask that applies to it, and
-- `pay_ask` says which ask (`employed` or `freelance`); both stay null when the
-- two cannot be compared. Nothing here fills them: the worker works them out
-- for every match when it starts and every few hours after, so a deploy needs
-- no backfill step. See lib/salary/pay-fit.ts.
--
-- Match Config's two columns are the setting: leave out jobs paying below the
-- ask by more than the tolerance, off by default.

ALTER TABLE "job_matches" ADD COLUMN "pay_ratio" double precision;--> statement-breakpoint
ALTER TABLE "job_matches" ADD COLUMN "pay_ask" varchar(16);--> statement-breakpoint
ALTER TABLE "match_config" ADD COLUMN "hide_below_ask" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "match_config" ADD COLUMN "below_ask_tolerance_pct" integer DEFAULT 10 NOT NULL;
