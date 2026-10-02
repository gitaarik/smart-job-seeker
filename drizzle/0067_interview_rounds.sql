-- Interview rounds replace the interviewing stages, and the next action goes.
--
-- An interview process was one label from a list of kinds ("Technical
-- interview", "Hiring manager call") plus a next action moved along by hand
-- (Need to schedule, Scheduled, Awaiting result). The list never said which
-- round an application had reached and had no entry for a first conversation
-- that is not technical, and the action held either its stage's default or a
-- date. Now `interview_rounds` holds the rounds, numbered by position, and the
-- next step is worked out from the stage and the rounds' dates. See
-- planning/INTERVIEW-ROUNDS.md.
--
-- The rounds are built from each application's timeline: its rows into
-- interviewing, in order, where a run of rows with the same stage is one round
-- (Scheduled and then Awaiting result under one label was one interview, not
-- two). A round's date is the one its "Scheduled" row carried, else any date on
-- its rows. The old stage becomes the round's kind where the new list has one,
-- and a stage someone typed stays as typed. An interviewing application whose
-- timeline has no such row gets one round from its own columns.
--
-- The timeline keeps every row as written: `application_status_log.action` is
-- not dropped, because what was said at the time is the record.
ALTER TABLE "applications" ADD COLUMN "interview_rounds" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
WITH steps AS (
	SELECT
		l."id",
		l."application",
		l."step",
		l."action",
		l."action_date",
		lag(l."step") OVER (PARTITION BY l."application" ORDER BY l."id") AS previous_step,
		row_number() OVER (PARTITION BY l."application" ORDER BY l."id") AS position
	FROM "application_status_log" AS l
	WHERE l."to_status" = 'interviewing'
),
runs AS (
	SELECT
		steps.*,
		sum(CASE WHEN position = 1 OR "step" IS DISTINCT FROM previous_step THEN 1 ELSE 0 END)
			OVER (PARTITION BY "application" ORDER BY "id") AS round_number
	FROM steps
),
rounds AS (
	SELECT
		"application",
		round_number,
		(array_agg("step" ORDER BY "id"))[1] AS step,
		coalesce(
			max("action_date") FILTER (WHERE "action" = 'Scheduled'),
			max("action_date")
		) AS booked
	FROM runs
	GROUP BY "application", round_number
)
UPDATE "applications" AS a
SET "interview_rounds" = built.rounds
FROM (
	SELECT
		"application",
		jsonb_agg(
			jsonb_build_object(
				'kind', CASE step
					WHEN 'Screening call' THEN 'Screening'
					WHEN 'AI interview' THEN 'Screening'
					WHEN 'Assessment / test' THEN 'Assignment'
					WHEN 'Coding challenge' THEN 'Assignment'
					WHEN 'Take-home assignment' THEN 'Assignment'
					WHEN 'Technical interview' THEN 'Technical'
					WHEN 'Hiring manager call' THEN 'Intro'
					WHEN 'Team interview' THEN 'Team'
					WHEN 'Final interview' THEN 'Final'
					WHEN 'Reference check' THEN 'References'
					ELSE step
				END,
				'date', to_char(booked, 'YYYY-MM-DD'),
				'time', NULL,
				'with', NULL
			)
			ORDER BY round_number
		) AS rounds
	FROM rounds
	GROUP BY "application"
) AS built
WHERE built."application" = a."id";--> statement-breakpoint
UPDATE "applications"
SET "interview_rounds" = jsonb_build_array(
	jsonb_build_object(
		'kind', CASE "status_step"
			WHEN 'Screening call' THEN 'Screening'
			WHEN 'AI interview' THEN 'Screening'
			WHEN 'Assessment / test' THEN 'Assignment'
			WHEN 'Coding challenge' THEN 'Assignment'
			WHEN 'Take-home assignment' THEN 'Assignment'
			WHEN 'Technical interview' THEN 'Technical'
			WHEN 'Hiring manager call' THEN 'Intro'
			WHEN 'Team interview' THEN 'Team'
			WHEN 'Final interview' THEN 'Final'
			WHEN 'Reference check' THEN 'References'
			ELSE "status_step"
		END,
		'date', to_char("status_action_date", 'YYYY-MM-DD'),
		'time', NULL,
		'with', NULL
	)
)
WHERE "status" = 'interviewing' AND "interview_rounds" = '[]'::jsonb;--> statement-breakpoint
-- An application back in applying has not been interviewed, whatever its
-- timeline once said; the writer clears rounds on that move from now on.
UPDATE "applications"
SET "interview_rounds" = '[]'::jsonb
WHERE "status" IN ('applying', 'preparing', 'sent', 'draft') AND "interview_rounds" <> '[]'::jsonb;--> statement-breakpoint
-- Interviewing's position is its round now, not a stage label.
UPDATE "applications" SET "status_step" = NULL WHERE "status" = 'interviewing';--> statement-breakpoint
ALTER TABLE "applications" DROP COLUMN "status_action";--> statement-breakpoint
ALTER TABLE "applications" DROP COLUMN "status_action_date";
