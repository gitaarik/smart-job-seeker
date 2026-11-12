-- Board slugs are case-insensitive at every provider we fetch (the Ashby API
-- served "Commure" and "commure" the same postings), and the open-jobs seed
-- carried 143 such pairs, so one opening came back twice from two boards in
-- the first feed run. Keep the oldest board of each pair (its postings with
-- it; the duplicate's go through the cascade), then lower-case every slug.
DELETE FROM "ats_boards" b
USING "ats_boards" k
WHERE k."provider" = b."provider"
  AND lower(k."slug") = lower(b."slug")
  AND k."id" < b."id";
--> statement-breakpoint
UPDATE "ats_boards" SET "slug" = lower("slug") WHERE "slug" <> lower("slug");
