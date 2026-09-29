-- Give an application's texts an order that stays put, and one the applicant can
-- set.
--
-- The texts page sorted letters and questions together by last edit, so saving
-- an answer moved it to the top. They are in date-added order now, newest first,
-- and a drag puts them in the applicant's own order, stored in `sort`: one
-- number space across both tables, since the page shows them as one list. See
-- $lib/texts/text-order.ts.
--
-- Letters get the column. Questions had one, written as "last + 1" on create
-- and never changed after, since nothing could reorder them: it says only what
-- `date_created` already does. Left in place it would read as a manual order
-- and put every application with questions in manual mode, so it is cleared.
ALTER TABLE "application_letters" ADD COLUMN "sort" integer;--> statement-breakpoint
UPDATE "application_questions" SET "sort" = NULL WHERE "sort" IS NOT NULL;
