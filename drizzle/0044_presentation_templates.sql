-- Rename resume_templates -> presentation_templates and give it a `kind`.
--
-- HAND-WRITTEN. `drizzle-kit generate` cannot tell a rename from a
-- drop-and-create without being asked interactively, and answering it wrong
-- emits `DROP TABLE ... CASCADE` — which here would take every template, every
-- asset row, and (by cascade) every profile_template_overrides row with it.
-- The accompanying snapshot is drizzle's own and describes the same target
-- schema either way; `scripts/check-migrations.ts` is what proves these
-- statements build exactly what schema.ts describes.
--
-- The table now holds two kinds: `document` (a resume/CV template, all it ever
-- held) and `portfolio` (a theme for the public profile site). See the schema
-- comment on `presentation_templates` for why that is one table and not two.

ALTER TABLE "resume_templates" RENAME TO "presentation_templates";--> statement-breakpoint
ALTER TABLE "resume_template_assets" RENAME TO "presentation_template_assets";--> statement-breakpoint

-- A table rename leaves every constraint, index and sequence carrying the old
-- name. They are renamed too, so nothing in the database still says "resume".
ALTER TABLE "presentation_templates" RENAME CONSTRAINT "resume_templates_pkey" TO "presentation_templates_pkey";--> statement-breakpoint
ALTER TABLE "presentation_templates" RENAME CONSTRAINT "resume_templates_profile_foreign" TO "presentation_templates_profile_foreign";--> statement-breakpoint
ALTER SEQUENCE "resume_templates_id_seq" RENAME TO "presentation_templates_id_seq";--> statement-breakpoint

ALTER TABLE "presentation_template_assets" RENAME CONSTRAINT "resume_template_assets_pkey" TO "presentation_template_assets_pkey";--> statement-breakpoint
ALTER TABLE "presentation_template_assets" RENAME CONSTRAINT "resume_template_assets_template_key_unique" TO "presentation_template_assets_template_key_unique";--> statement-breakpoint
ALTER TABLE "presentation_template_assets" RENAME CONSTRAINT "resume_template_assets_template_foreign" TO "presentation_template_assets_template_foreign";--> statement-breakpoint
ALTER TABLE "presentation_template_assets" RENAME CONSTRAINT "resume_template_assets_file_foreign" TO "presentation_template_assets_file_foreign";--> statement-breakpoint
ALTER INDEX "resume_template_assets_file_idx" RENAME TO "presentation_template_assets_file_idx";--> statement-breakpoint
ALTER SEQUENCE "resume_template_assets_id_seq" RENAME TO "presentation_template_assets_id_seq";--> statement-breakpoint

-- Everything that exists today is a CV template, which is what the default says.
ALTER TABLE "presentation_templates" ADD COLUMN "kind" varchar(32) DEFAULT 'document' NOT NULL;--> statement-breakpoint

-- (profile, kind, slug) has to be unique before the index below can exist, and
-- it was never enforced: two templates could answer to one slug while
-- `getResumeTemplate` picked a winner with an unordered `findFirst`, and
-- `profile_exports.template` / `applications.cv_template_sent` reference
-- templates by that slug. Any duplicate is therefore already a reference no
-- one can resolve.
--
-- The oldest row keeps the slug because it is the one those references are
-- most likely to have meant. The rest are re-slugged rather than deleted —
-- losing a template outright is far worse than one whose slug moved, and the
-- id suffix makes the result unique in a single pass. If a collision somehow
-- survives, the unique index below fails the migration rather than letting it
-- through.
UPDATE "presentation_templates" t
   SET "slug" = t."slug" || '-' || t."id"
  FROM (
    SELECT "id",
           row_number() OVER (PARTITION BY "profile_id", "kind", "slug" ORDER BY "id") AS n
      FROM "presentation_templates"
  ) d
 WHERE d."id" = t."id" AND d.n > 1;--> statement-breakpoint

CREATE UNIQUE INDEX "presentation_templates_profile_kind_slug_key" ON "presentation_templates" USING btree ("profile_id","kind","slug");
