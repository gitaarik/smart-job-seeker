-- "Respond" became "Reply to offer".
--
-- The old label did not say what you owed. It was also the default next action on
-- a received offer, so it is the one word sitting on the most consequential row in
-- the pipeline, and "needs you" is the whole of what it was communicating.
--
-- Same reason as 0041 for moving the rows rather than leaving them: the action
-- `<select>` has no option matching an unlisted value, so the editor would show an
-- empty Action on an application that has one. `isWaitingAction` reads the prefix
-- rather than the list, so the tier these rows sort into is unaffected either way.
--
-- `application_status_log.action` keeps the old word, as history does.
--
-- Re-running this is a no-op.
UPDATE "applications"
SET "status_action" = 'Reply to offer'
WHERE "status_action" = 'Respond';
