-- The portfolio site's two publish pointers on `profiles`, mirroring the
-- resume/CV pair beside them: which version feeds the site, and which theme
-- dresses it. Both null means unpublished; there is no separate flag, because
-- published is exactly "something to show and something to show it with".
--
-- Both ON DELETE SET NULL: losing a version or a theme should take the site
-- dark, not refuse the delete.
--
-- The theme constraint carries drizzle's generated name rather than the
-- `_foreign` convention its neighbour uses, because that FK is declared inline
-- in schema.ts with an `AnyPgColumn` return type. It has to be: presentation_
-- templates already points at profiles, so this edge closes a type cycle, and
-- without the annotation TypeScript abandons both tables and 523 errors appear
-- across files that never mentioned either.

ALTER TABLE "profiles" ADD COLUMN "public_portfolio_version_id" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "public_portfolio_theme_id" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_public_portfolio_theme_id_presentation_templates_id_fk" FOREIGN KEY ("public_portfolio_theme_id") REFERENCES "public"."presentation_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_public_portfolio_version_foreign" FOREIGN KEY ("public_portfolio_version_id") REFERENCES "public"."profile_versions"("id") ON DELETE set null ON UPDATE no action;