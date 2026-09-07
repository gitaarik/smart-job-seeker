-- Stop presenting the editor's own review request as something the applicant
-- wrote.
--
-- "AI review" sends a fixed sentence ("Please review my letter and give me
-- concise feedback: …") as the turn's prompt, and the followup path recorded it
-- as that version's `user_request`. The conversation editor renders
-- `user_request` in a "Your feedback" bubble with an Edit button, so every
-- review left a message in the thread that the applicant never typed, could
-- edit, could resend — and could not remove, because a turn with a message and
-- no content had no delete affordance at all. The recording stopped in
-- application-{letter,question}-followup.ts and profile-{story,cheatsheet}-
-- followup.ts; this clears the rows already written.
--
-- Narrow on purpose: only rows whose source is a review AND whose text is one
-- of the four canned openings. A review turn cannot carry a typed message today
-- (the editor sends no user text on that path), but if one ever does, matching
-- on source alone would delete it.
UPDATE "letter_versions" SET "user_request" = NULL
WHERE "source" = 'ai_review' AND "user_request" LIKE 'Please review my letter and give me concise feedback:%';--> statement-breakpoint
UPDATE "question_versions" SET "user_request" = NULL
WHERE "source" = 'ai_review' AND "user_request" LIKE 'Please review my answer and give me concise feedback:%';--> statement-breakpoint
UPDATE "story_versions" SET "user_request" = NULL
WHERE "source" = 'ai_review' AND "user_request" LIKE 'Please review my story and give me concise feedback:%';--> statement-breakpoint
UPDATE "cheat_sheet_versions" SET "user_request" = NULL
WHERE "source" = 'ai_review' AND "user_request" LIKE 'Please review my cheat sheet and give me concise feedback:%';
