-- Collapse the four "how you applied" stages into one.
--
-- `stepsByPhase.applying` offered "Applied through job platform", "Application
-- form completed", "E-mail sent" and "Resume / CV submitted" where it now offers
-- "Applied". The four were one position wearing four hats: same next action, same
-- effect on `application_sent_date`, and the quick action wrote the first of them
-- whatever had actually happened. See the note on `stepsByPhase` in
-- $lib/application-status.
--
-- The rows have to move with the vocabulary because two readers match this column
-- against it. `stageRank` scores an unlisted step at the start of its phase, so a
-- row left on "E-mail sent" would sort as though it were still being prepared;
-- and the stage `<select>` has no option to match it, so opening the editor on one
-- would show an empty Status for an application that has a perfectly good one.
--
-- Only this column. `application_status_log.step` and `application_records.step`
-- keep their original words: both are history rather than current state, both are
-- rendered as free text and never matched against the vocabulary, and a timeline
-- entry that says "E-mail sent" is an accurate record of what was chosen that day.
-- The channel survives there, which is the only place it was ever reliable.
--
-- Re-running this is a no-op.
UPDATE "applications"
SET "status_step" = 'Applied'
WHERE "status_step" IN (
	'Applied through job platform',
	'Application form completed',
	'E-mail sent',
	'Resume / CV submitted'
);
