-- Rename profile_versions.name -> slug, description -> name
-- Current "name" is a slug-like URL key (e.g., "fullstack-django")
-- Current "description" is the human-readable display name
ALTER TABLE "profile_versions" RENAME COLUMN "name" TO "slug";
ALTER TABLE "profile_versions" RENAME COLUMN "description" TO "name";
