ALTER TABLE IF EXISTS "directus_access" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_activity" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_collections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_comments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_dashboards" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_deployment_projects" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_deployment_runs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_deployments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_extensions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_fields" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_flows" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_folders" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_migrations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_notifications" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_operations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_panels" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_permissions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_policies" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_presets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_relations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_revisions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_roles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_shares" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_translations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "directus_versions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_access" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_activity" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_collections" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_comments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_dashboards" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_deployment_projects" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_deployment_runs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_deployments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_extensions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_fields" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_flows" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_folders" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_migrations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_notifications" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_operations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_panels" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_permissions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_policies" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_presets" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_relations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_revisions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_roles" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_sessions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_settings" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_shares" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_translations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_users" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "directus_versions" CASCADE;--> statement-breakpoint
ALTER TABLE "ai_prompts" DROP CONSTRAINT IF EXISTS "ai_prompts_user_created_foreign";
--> statement-breakpoint
ALTER TABLE "ai_prompts" DROP CONSTRAINT IF EXISTS "ai_prompts_user_updated_foreign";
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT IF EXISTS "directus_files_folder_foreign";
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT IF EXISTS "directus_files_modified_by_foreign";
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT IF EXISTS "directus_files_uploaded_by_foreign";
--> statement-breakpoint
ALTER TABLE "ai_prompts" DROP COLUMN IF EXISTS "user_created";--> statement-breakpoint
ALTER TABLE "ai_prompts" DROP COLUMN IF EXISTS "user_updated";--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "folder";--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "uploaded_by";--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN IF EXISTS "modified_by";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "public"."directus_activity_id_seq";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "public"."directus_activity_id_seq1";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "public"."directus_activity_id_seq2";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "public"."directus_activity_id_seq3";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "public"."directus_notifications_id_seq";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "public"."directus_notifications_id_seq1";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "public"."directus_notifications_id_seq2";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "public"."directus_notifications_id_seq3";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "public"."directus_presets_id_seq";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "public"."directus_presets_id_seq1";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "public"."directus_presets_id_seq2";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "public"."directus_presets_id_seq3";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "public"."directus_revisions_id_seq";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "public"."directus_revisions_id_seq1";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "public"."directus_revisions_id_seq2";--> statement-breakpoint
DROP SEQUENCE IF EXISTS "public"."directus_revisions_id_seq3";
