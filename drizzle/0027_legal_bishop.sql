ALTER TABLE "directus_access" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_activity" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_collections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_comments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_dashboards" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_deployment_projects" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_deployment_runs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_deployments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_extensions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_fields" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_flows" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_folders" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_migrations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_notifications" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_operations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_panels" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_permissions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_policies" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_presets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_relations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_revisions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_roles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_shares" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_translations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "directus_versions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "directus_access" CASCADE;--> statement-breakpoint
DROP TABLE "directus_activity" CASCADE;--> statement-breakpoint
DROP TABLE "directus_collections" CASCADE;--> statement-breakpoint
DROP TABLE "directus_comments" CASCADE;--> statement-breakpoint
DROP TABLE "directus_dashboards" CASCADE;--> statement-breakpoint
DROP TABLE "directus_deployment_projects" CASCADE;--> statement-breakpoint
DROP TABLE "directus_deployment_runs" CASCADE;--> statement-breakpoint
DROP TABLE "directus_deployments" CASCADE;--> statement-breakpoint
DROP TABLE "directus_extensions" CASCADE;--> statement-breakpoint
DROP TABLE "directus_fields" CASCADE;--> statement-breakpoint
DROP TABLE "directus_flows" CASCADE;--> statement-breakpoint
DROP TABLE "directus_folders" CASCADE;--> statement-breakpoint
DROP TABLE "directus_migrations" CASCADE;--> statement-breakpoint
DROP TABLE "directus_notifications" CASCADE;--> statement-breakpoint
DROP TABLE "directus_operations" CASCADE;--> statement-breakpoint
DROP TABLE "directus_panels" CASCADE;--> statement-breakpoint
DROP TABLE "directus_permissions" CASCADE;--> statement-breakpoint
DROP TABLE "directus_policies" CASCADE;--> statement-breakpoint
DROP TABLE "directus_presets" CASCADE;--> statement-breakpoint
DROP TABLE "directus_relations" CASCADE;--> statement-breakpoint
DROP TABLE "directus_revisions" CASCADE;--> statement-breakpoint
DROP TABLE "directus_roles" CASCADE;--> statement-breakpoint
DROP TABLE "directus_sessions" CASCADE;--> statement-breakpoint
DROP TABLE "directus_settings" CASCADE;--> statement-breakpoint
DROP TABLE "directus_shares" CASCADE;--> statement-breakpoint
DROP TABLE "directus_translations" CASCADE;--> statement-breakpoint
DROP TABLE "directus_users" CASCADE;--> statement-breakpoint
DROP TABLE "directus_versions" CASCADE;--> statement-breakpoint
ALTER TABLE "ai_prompts" DROP CONSTRAINT "ai_prompts_user_created_foreign";
--> statement-breakpoint
ALTER TABLE "ai_prompts" DROP CONSTRAINT "ai_prompts_user_updated_foreign";
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "directus_files_folder_foreign";
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "directus_files_modified_by_foreign";
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "directus_files_uploaded_by_foreign";
--> statement-breakpoint
ALTER TABLE "ai_prompts" DROP COLUMN "user_created";--> statement-breakpoint
ALTER TABLE "ai_prompts" DROP COLUMN "user_updated";--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN "folder";--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN "uploaded_by";--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN "modified_by";--> statement-breakpoint
DROP SEQUENCE "public"."directus_activity_id_seq";--> statement-breakpoint
DROP SEQUENCE "public"."directus_activity_id_seq1";--> statement-breakpoint
DROP SEQUENCE "public"."directus_activity_id_seq2";--> statement-breakpoint
DROP SEQUENCE "public"."directus_activity_id_seq3";--> statement-breakpoint
DROP SEQUENCE "public"."directus_notifications_id_seq";--> statement-breakpoint
DROP SEQUENCE "public"."directus_notifications_id_seq1";--> statement-breakpoint
DROP SEQUENCE "public"."directus_notifications_id_seq2";--> statement-breakpoint
DROP SEQUENCE "public"."directus_notifications_id_seq3";--> statement-breakpoint
DROP SEQUENCE "public"."directus_presets_id_seq";--> statement-breakpoint
DROP SEQUENCE "public"."directus_presets_id_seq1";--> statement-breakpoint
DROP SEQUENCE "public"."directus_presets_id_seq2";--> statement-breakpoint
DROP SEQUENCE "public"."directus_presets_id_seq3";--> statement-breakpoint
DROP SEQUENCE "public"."directus_revisions_id_seq";--> statement-breakpoint
DROP SEQUENCE "public"."directus_revisions_id_seq1";--> statement-breakpoint
DROP SEQUENCE "public"."directus_revisions_id_seq2";--> statement-breakpoint
DROP SEQUENCE "public"."directus_revisions_id_seq3";