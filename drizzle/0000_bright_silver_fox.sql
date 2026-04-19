-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."Role" AS ENUM('USER', 'ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE SEQUENCE "public"."ai_chats_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."ai_chats_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."ai_chats_id_seq2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."ai_chats_id_seq3" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."application_activity_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."application_activity_log_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."application_activity_log_id_seq2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."application_activity_log_id_seq3" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."application_letters_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."application_letters_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."application_letters_id_seq2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."application_letters_id_seq3" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."application_questions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."application_questions_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."application_questions_id_seq2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."application_questions_id_seq3" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."application_questions_id_seq4" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."applications_files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."applications_files_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."applications_files_id_seq2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."applications_files_id_seq3" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."applications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."applications_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."applications_id_seq2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."applications_id_seq3" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."cheat_sheets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."config_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."config_id_seq2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."config_id_seq3" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."dev_methodologies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."directus_activity_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."directus_activity_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."directus_activity_id_seq2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."directus_activity_id_seq3" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."directus_notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."directus_notifications_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."directus_notifications_id_seq2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."directus_notifications_id_seq3" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."directus_presets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."directus_presets_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."directus_presets_id_seq2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."directus_presets_id_seq3" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."directus_revisions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."directus_revisions_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."directus_revisions_id_seq2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."directus_revisions_id_seq3" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."highlights_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."job_matches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."job_matches_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."job_matches_id_seq2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."job_matches_id_seq3" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."job_resources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."job_resources_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."job_resources_id_seq2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."job_resources_id_seq3" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."jobs_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."jobs_id_seq2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."jobs_id_seq3" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."languages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."profile_exports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."profile_exports_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."profile_exports_id_seq2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."profile_exports_id_seq3" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."profile_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."profile_tokens_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."profile_tokens_id_seq2" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."profile_tokens_id_seq3" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."project_stories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."side_project_achievements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."soft_skills_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."tech_skill_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."work_experience_achievements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."work_experience_technologies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "_prisma_migrations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"finished_at" timestamp with time zone,
	"migration_name" varchar(255) NOT NULL,
	"logs" text,
	"rolled_back_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_steps_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"key" varchar(255) NOT NULL,
	"system_prompt" text,
	"user_prompt" text,
	"format" json,
	CONSTRAINT "ai_chat_templates_key_key" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "ai_prompts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sort" integer,
	"date_created" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"user_created" uuid,
	"date_updated" timestamp(6) with time zone,
	"user_updated" uuid,
	"name" varchar(255),
	"status" varchar(255) DEFAULT 'draft',
	"description" text,
	"system_prompt" text,
	"messages" json
);
--> statement-breakpoint
CREATE TABLE "application_activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp(6) with time zone,
	"date_updated" timestamp(6) with time zone,
	"date" date,
	"title" varchar(255),
	"note" text,
	"application_id" integer
);
--> statement-breakpoint
CREATE TABLE "applications_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"applications_id" integer,
	"file_id" uuid
);
--> statement-breakpoint
CREATE TABLE "collected_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_updated" timestamp with time zone,
	"schema" text,
	"data" text,
	"profile_id" integer
);
--> statement-breakpoint
CREATE TABLE "directus_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"collection" varchar(64) NOT NULL,
	"item" varchar(255) NOT NULL,
	"comment" text NOT NULL,
	"date_created" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"date_updated" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"user_created" uuid,
	"user_updated" uuid
);
--> statement-breakpoint
CREATE TABLE "directus_dashboards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"icon" varchar(64) DEFAULT 'dashboard' NOT NULL,
	"note" text,
	"date_created" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"user_created" uuid,
	"color" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "directus_deployments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" varchar(255) NOT NULL,
	"credentials" text,
	"options" text,
	"date_created" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"user_created" uuid
);
--> statement-breakpoint
CREATE TABLE "directus_deployment_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"target" varchar(255) NOT NULL,
	"date_created" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"user_created" uuid
);
--> statement-breakpoint
CREATE TABLE "directus_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" varchar(45) NOT NULL,
	"user" uuid,
	"timestamp" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"ip" varchar(50),
	"user_agent" text,
	"collection" varchar(64) NOT NULL,
	"item" varchar(255) NOT NULL,
	"origin" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "config" (
	"id" serial PRIMARY KEY NOT NULL,
	"default_profile" integer
);
--> statement-breakpoint
CREATE TABLE "directus_access" (
	"id" uuid PRIMARY KEY NOT NULL,
	"role" uuid,
	"user" uuid,
	"policy" uuid NOT NULL,
	"sort" integer
);
--> statement-breakpoint
CREATE TABLE "directus_collections" (
	"collection" varchar(64) PRIMARY KEY NOT NULL,
	"icon" varchar(64),
	"note" text,
	"display_template" varchar(255),
	"hidden" boolean DEFAULT false NOT NULL,
	"singleton" boolean DEFAULT false NOT NULL,
	"translations" json,
	"archive_field" varchar(64),
	"archive_app_filter" boolean DEFAULT true NOT NULL,
	"archive_value" varchar(255),
	"unarchive_value" varchar(255),
	"sort_field" varchar(64),
	"accountability" varchar(255) DEFAULT 'all',
	"color" varchar(255),
	"item_duplication_fields" json,
	"sort" integer,
	"group" varchar(64),
	"collapse" varchar(255) DEFAULT 'open' NOT NULL,
	"preview_url" varchar(255),
	"versioning" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directus_extensions" (
	"enabled" boolean DEFAULT true NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"folder" varchar(255) NOT NULL,
	"source" varchar(255) NOT NULL,
	"bundle" uuid
);
--> statement-breakpoint
CREATE TABLE "directus_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection" varchar(64) NOT NULL,
	"field" varchar(64) NOT NULL,
	"special" varchar(64),
	"interface" varchar(64),
	"options" json,
	"display" varchar(64),
	"display_options" json,
	"readonly" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"sort" integer,
	"width" varchar(30) DEFAULT 'full',
	"translations" json,
	"note" text,
	"conditions" json,
	"required" boolean DEFAULT false,
	"group" varchar(64),
	"validation" json,
	"validation_message" text,
	"searchable" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directus_folders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"parent" uuid
);
--> statement-breakpoint
CREATE TABLE "directus_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"status" varchar(255) DEFAULT 'inbox',
	"recipient" uuid NOT NULL,
	"sender" uuid,
	"subject" varchar(255) NOT NULL,
	"message" text,
	"collection" varchar(64),
	"item" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "directus_migrations" (
	"version" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "directus_flows" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"icon" varchar(64),
	"color" varchar(255),
	"description" text,
	"status" varchar(255) DEFAULT 'active' NOT NULL,
	"trigger" varchar(255),
	"accountability" varchar(255) DEFAULT 'all',
	"options" json,
	"operation" uuid,
	"date_created" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"user_created" uuid,
	CONSTRAINT "directus_flows_operation_unique" UNIQUE("operation")
);
--> statement-breakpoint
CREATE TABLE "directus_presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"bookmark" varchar(255),
	"user" uuid,
	"role" uuid,
	"collection" varchar(64),
	"search" varchar(100),
	"layout" varchar(100) DEFAULT 'tabular',
	"layout_query" json,
	"layout_options" json,
	"refresh_interval" integer,
	"filter" json,
	"icon" varchar(64) DEFAULT 'bookmark',
	"color" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "directus_panels" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dashboard" uuid NOT NULL,
	"name" varchar(255),
	"icon" varchar(64),
	"color" varchar(10),
	"show_header" boolean DEFAULT false NOT NULL,
	"note" text,
	"type" varchar(255) NOT NULL,
	"position_x" integer NOT NULL,
	"position_y" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"options" json,
	"date_created" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"user_created" uuid
);
--> statement-breakpoint
CREATE TABLE "directus_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity" integer NOT NULL,
	"collection" varchar(64) NOT NULL,
	"item" varchar(255) NOT NULL,
	"data" json,
	"delta" json,
	"parent" integer,
	"version" uuid
);
--> statement-breakpoint
CREATE TABLE "directus_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"many_collection" varchar(64) NOT NULL,
	"many_field" varchar(64) NOT NULL,
	"one_collection" varchar(64),
	"one_field" varchar(64),
	"one_collection_field" varchar(64),
	"one_allowed_collections" text,
	"junction_field" varchar(64),
	"sort_field" varchar(64),
	"one_deselect_action" varchar(255) DEFAULT 'nullify' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directus_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection" varchar(64) NOT NULL,
	"action" varchar(10) NOT NULL,
	"permissions" json,
	"validation" json,
	"presets" json,
	"fields" text,
	"policy" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directus_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" varchar(64) NOT NULL,
	"name" varchar(255),
	"collection" varchar(64) NOT NULL,
	"item" varchar(255) NOT NULL,
	"hash" varchar(255),
	"date_created" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"date_updated" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"user_created" uuid,
	"user_updated" uuid,
	"delta" json
);
--> statement-breakpoint
CREATE TABLE "directus_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_name" varchar(100) DEFAULT 'Directus' NOT NULL,
	"project_url" varchar(255),
	"project_color" varchar(255) DEFAULT '#6644FF' NOT NULL,
	"project_logo" uuid,
	"public_foreground" uuid,
	"public_background" uuid,
	"public_note" text,
	"auth_login_attempts" integer DEFAULT 25,
	"auth_password_policy" varchar(100),
	"storage_asset_transform" varchar(7) DEFAULT 'all',
	"storage_asset_presets" json,
	"custom_css" text,
	"storage_default_folder" uuid,
	"basemaps" json,
	"mapbox_key" varchar(255),
	"module_bar" json,
	"project_descriptor" varchar(100),
	"default_language" varchar(255) DEFAULT 'en-US' NOT NULL,
	"custom_aspect_ratios" json,
	"public_favicon" uuid,
	"default_appearance" varchar(255) DEFAULT 'auto' NOT NULL,
	"default_theme_light" varchar(255),
	"theme_light_overrides" json,
	"default_theme_dark" varchar(255),
	"theme_dark_overrides" json,
	"report_error_url" varchar(255),
	"report_bug_url" varchar(255),
	"report_feature_url" varchar(255),
	"public_registration" boolean DEFAULT false NOT NULL,
	"public_registration_verify_email" boolean DEFAULT true NOT NULL,
	"public_registration_role" uuid,
	"public_registration_email_filter" json,
	"visual_editor_urls" json,
	"project_id" uuid,
	"mcp_enabled" boolean DEFAULT false NOT NULL,
	"mcp_allow_deletes" boolean DEFAULT false NOT NULL,
	"mcp_prompts_collection" varchar(255) DEFAULT NULL,
	"mcp_system_prompt_enabled" boolean DEFAULT true NOT NULL,
	"mcp_system_prompt" text,
	"project_owner" varchar(255),
	"project_usage" varchar(255),
	"org_name" varchar(255),
	"product_updates" boolean,
	"project_status" varchar(255),
	"ai_openai_api_key" text,
	"ai_anthropic_api_key" text,
	"ai_system_prompt" text,
	"ai_google_api_key" text,
	"ai_openai_compatible_api_key" text,
	"ai_openai_compatible_base_url" text,
	"ai_openai_compatible_name" text,
	"ai_openai_compatible_models" json,
	"ai_openai_compatible_headers" json,
	"ai_openai_allowed_models" json,
	"ai_anthropic_allowed_models" json,
	"ai_google_allowed_models" json,
	"collaborative_editing_enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"institution" varchar(255),
	"location" varchar(255),
	"url" varchar(255),
	"area" varchar(255),
	"study_type" varchar(255),
	"graduation_year" integer,
	"start_date" date,
	"end_date" date,
	"profile_id" integer NOT NULL,
	"summary" text,
	"logo_id" uuid,
	"tags" json,
	"logo_path" varchar(255),
	"banner_path" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "highlights" (
	"id" integer PRIMARY KEY DEFAULT nextval('highlights_id_seq'::regclass) NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"profile_id" integer NOT NULL,
	"text" varchar(255),
	"fa_icon" varchar(255),
	"type" varchar(50) DEFAULT 'highlight',
	"icon_name" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "directus_translations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"language" varchar(255) NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directus_roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"icon" varchar(64) DEFAULT 'supervised_user_circle' NOT NULL,
	"description" text,
	"parent" uuid
);
--> statement-breakpoint
CREATE TABLE "directus_shares" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"collection" varchar(64) NOT NULL,
	"item" varchar(255) NOT NULL,
	"role" uuid,
	"password" varchar(255),
	"user_created" uuid,
	"date_created" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"date_start" timestamp(6) with time zone,
	"date_end" timestamp(6) with time zone,
	"times_used" integer DEFAULT 0,
	"max_uses" integer
);
--> statement-breakpoint
CREATE TABLE "match_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"job_types" json,
	"experience_levels" json,
	"work_location" json,
	"locations" json,
	"profile_id" integer NOT NULL,
	"name" varchar(255),
	"match_community_jobs" boolean DEFAULT false NOT NULL,
	"remote_only" boolean DEFAULT false NOT NULL,
	"community_max_age_days" integer
);
--> statement-breakpoint
CREATE TABLE "job_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"reasoning" text,
	"skill_match_percentage" integer,
	"strengths" json,
	"gaps" json,
	"recommendation" varchar(255) DEFAULT 'consider',
	"job_date_updated_when_matched" timestamp(6) with time zone,
	"date_created" timestamp(6) with time zone,
	"date_updated" timestamp(6) with time zone,
	"job_id" integer NOT NULL,
	"profile_id" integer NOT NULL,
	"llm_prompt" text,
	"ai_chat_scoring" integer,
	"matched_skills" json,
	"match_summary" text
);
--> statement-breakpoint
CREATE TABLE "directus_users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_name" varchar(50),
	"last_name" varchar(50),
	"email" varchar(128),
	"password" varchar(255),
	"location" varchar(255),
	"title" varchar(50),
	"description" text,
	"tags" json,
	"avatar" uuid,
	"language" varchar(255) DEFAULT NULL,
	"tfa_secret" varchar(255),
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"role" uuid,
	"token" varchar(255),
	"last_access" timestamp with time zone,
	"last_page" varchar(255),
	"provider" varchar(128) DEFAULT 'default' NOT NULL,
	"external_identifier" varchar(255),
	"auth_data" json,
	"email_notifications" boolean DEFAULT true,
	"appearance" varchar(255),
	"theme_dark" varchar(255),
	"theme_light" varchar(255),
	"theme_light_overrides" json,
	"theme_dark_overrides" json,
	"text_direction" varchar(255) DEFAULT 'auto' NOT NULL,
	CONSTRAINT "directus_users_email_unique" UNIQUE("email"),
	CONSTRAINT "directus_users_token_unique" UNIQUE("token"),
	CONSTRAINT "directus_users_external_identifier_unique" UNIQUE("external_identifier")
);
--> statement-breakpoint
CREATE TABLE "job_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"sort" integer,
	"date_created" timestamp(6) with time zone,
	"date_updated" timestamp(6) with time zone,
	"name" varchar(255),
	"url" varchar(255),
	"file_id" uuid,
	"job_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_task_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"search_task_id" integer NOT NULL,
	"status" varchar(50) NOT NULL,
	"started_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"finished_at" timestamp(6) with time zone,
	"jobs_found" integer,
	"error_message" text,
	"triggered_by" varchar(20) NOT NULL,
	"bullmq_job_id" varchar(100),
	"live_url" varchar(500),
	"user_response" varchar(20),
	"settings" jsonb,
	"verification_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "os_contributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"title" varchar(255),
	"description" text,
	"project_name" varchar(255),
	"profile_id" integer,
	"merged_date" date,
	"issue_url" varchar(255),
	"pull_request_url" varchar(255),
	"contribution_type" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "platform_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(255) DEFAULT 'signup_in_progress' NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"profile_id" integer NOT NULL,
	"platform_id" integer,
	"username" varchar(255),
	"password" varchar(255) DEFAULT NULL,
	"api_token" text,
	"last_login_at" timestamp with time zone,
	"login_error" text,
	"provider_profile_id" varchar(255),
	"security_answer" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "languages" (
	"id" integer PRIMARY KEY DEFAULT nextval('languages_id_seq'::regclass) NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"name" varchar(255),
	"language_code" varchar(255),
	"proficiency" varchar(255),
	"profile_id" integer NOT NULL,
	"sort" integer
);
--> statement-breakpoint
CREATE TABLE "job_platforms" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"name" varchar(255) NOT NULL,
	"url" varchar(255) NOT NULL,
	"type" varchar(255),
	"key" varchar(255) DEFAULT NULL NOT NULL,
	"login_page_url" varchar(255),
	CONSTRAINT "job_platforms_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "search_task_run_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"position" integer NOT NULL,
	"clickable_id" integer,
	"title" varchar(500),
	"company" varchar(255),
	"location" varchar(255),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"status_message" text,
	"job_id" integer,
	"was_created" boolean,
	"created_at" timestamp with time zone DEFAULT now(),
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"date_created" timestamp(6) with time zone,
	"date_updated" timestamp(6) with time zone,
	"source_url" varchar(2048),
	"title" varchar(255),
	"job_description" text,
	"job_poster" varchar(255),
	"company_description" text,
	"date_posted" date,
	"salary_min" integer,
	"salary_max" integer,
	"salary_currency" varchar(255),
	"salary_period" varchar(255),
	"import_error" text,
	"last_scraped" timestamp(6) with time zone,
	"office_location" varchar(255),
	"scrape_count" integer DEFAULT 0,
	"job_types" json,
	"experience_levels" json,
	"work_location" json,
	"source_html_stripped" text,
	"job_platform_id" integer,
	"ai_chat_extraction" integer,
	"company" varchar(255),
	"skills_required" json,
	"skills_preferred" json,
	"responsibilities" jsonb,
	"soft_skills" jsonb,
	"rescrape_status" varchar(50) DEFAULT NULL,
	"rescrape_message" text,
	"rescrape_live_url" text,
	"region" varchar(50),
	"salary_duration_weeks" double precision
);
--> statement-breakpoint
CREATE TABLE "profile_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(255) DEFAULT 'published' NOT NULL,
	"sort" integer,
	"date_created" timestamp(6) with time zone,
	"date_updated" timestamp(6) with time zone,
	"token" varchar(255) NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"profile_version" integer NOT NULL,
	"visit_count" integer DEFAULT 0 NOT NULL,
	"visit_limit" integer,
	"expires_at" timestamp(6) with time zone,
	"name" varchar(255),
	"notes" text,
	"last_accessed_at" timestamp(6) with time zone,
	"last_accessed_ip" varchar(45),
	"format" varchar(20) DEFAULT 'resume' NOT NULL,
	"view_mode" varchar(10) DEFAULT 'html' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_stories" (
	"id" integer PRIMARY KEY DEFAULT nextval('project_stories_id_seq'::regclass) NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"title" varchar(255),
	"situation" text,
	"task" text,
	"action" text,
	"result" text,
	"reflection" text,
	"category" varchar(255),
	"profile_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_exports" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(255) DEFAULT 'published' NOT NULL,
	"sort" integer,
	"date_created" timestamp(6) with time zone,
	"date_updated" timestamp(6) with time zone,
	"profile_id" integer NOT NULL,
	"file_id" uuid NOT NULL,
	"file_type" varchar(255) NOT NULL,
	"export_type" varchar(255) NOT NULL,
	"export_format" varchar(255),
	"description" text,
	"source_url" varchar(512)
);
--> statement-breakpoint
CREATE TABLE "references" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"author" varchar(255) DEFAULT NULL NOT NULL,
	"author_position" varchar(255),
	"text" text,
	"profile_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraper_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"level" varchar(10) NOT NULL,
	"message" text NOT NULL,
	"timestamp" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_expectations" (
	"id" serial PRIMARY KEY NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"job_title" varchar(255),
	"company_type" varchar(255) DEFAULT NULL NOT NULL,
	"employment_type" varchar(255) DEFAULT NULL NOT NULL,
	"work_arrangement" varchar(255) DEFAULT NULL NOT NULL,
	"region" varchar(255) DEFAULT NULL NOT NULL,
	"hourly_rate" integer,
	"month_salary" integer,
	"year_salary" integer,
	"daily_rate" integer,
	"profile_id" integer NOT NULL,
	"currency" varchar(255) DEFAULT 'EUR',
	"experience_level" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "profile_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"slug" varchar(255),
	"name" text,
	"profile_id" integer NOT NULL,
	"toggles" json,
	"preview_links" text
);
--> statement-breakpoint
CREATE TABLE "side_project_technologies" (
	"id" serial PRIMARY KEY NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"name" varchar(255),
	"side_project_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_experience_achievements" (
	"id" integer PRIMARY KEY DEFAULT nextval('work_experience_achievements_id_seq'::regclass) NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"description" varchar(255),
	"work_experience_id" integer NOT NULL,
	"fa_icon" varchar(255),
	"tags" json
);
--> statement-breakpoint
CREATE TABLE "tech_skill_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"name" varchar(255),
	"slug" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"token" varchar(255) NOT NULL,
	"expiresAt" timestamp(6) with time zone NOT NULL,
	"ipAddress" varchar(255),
	"userAgent" text,
	"createdAt" timestamp(6) with time zone,
	"updatedAt" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"value" varchar(255) NOT NULL,
	"expiresAt" timestamp(6) with time zone NOT NULL,
	"createdAt" timestamp(6) with time zone,
	"updatedAt" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "work_experience_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"work_experience_id" integer,
	"name" varchar(255),
	"url" varchar(255),
	"start_date" date,
	"end_date" date,
	"description" text,
	"outcome" text
);
--> statement-breakpoint
CREATE TABLE "work_experience_technologies" (
	"id" integer PRIMARY KEY DEFAULT nextval('work_experience_technologies_id_seq'::regclass) NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"name" varchar(255),
	"work_experience_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"emailVerified" boolean DEFAULT false,
	"name" varchar(255),
	"image" varchar(255),
	"createdAt" timestamp(6) with time zone,
	"updatedAt" timestamp(6) with time zone,
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_staff" boolean DEFAULT false NOT NULL,
	"is_approved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "side_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"name" varchar(255),
	"start_date" date,
	"end_date" date,
	"profile_id" integer NOT NULL,
	"url" varchar(255),
	"stars" integer,
	"summary" text,
	"url_label" varchar(255),
	"tags" json,
	"image_path" varchar(255),
	"banner_path" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "tech_skill_categories" (
	"id" integer PRIMARY KEY DEFAULT nextval('tech_skill_categories_id_seq'::regclass) NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"name" varchar(255),
	"profile_id" integer NOT NULL,
	"fa_icon" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "work_experience_project_technologies" (
	"id" serial PRIMARY KEY NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"work_experience_project_id" integer,
	"name" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "tech_skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"name" varchar(255),
	"category_id" integer NOT NULL,
	"level" varchar(255),
	"tech_type_id" integer,
	"years_experience" integer,
	"tags" json
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"accountId" varchar(255) NOT NULL,
	"providerId" varchar(255) NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"accessTokenExpiresAt" timestamp(6) with time zone,
	"refreshTokenExpiresAt" timestamp(6) with time zone,
	"scope" varchar(255),
	"idToken" text,
	"password" varchar(255),
	"createdAt" timestamp(6) with time zone,
	"updatedAt" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "cheat_sheets" (
	"id" integer PRIMARY KEY DEFAULT nextval('cheat_sheets_id_seq'::regclass) NOT NULL,
	"sort" integer,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"title" varchar(255),
	"content" text,
	"profile_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directus_policies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"icon" varchar(64) DEFAULT 'badge' NOT NULL,
	"description" text,
	"ip_access" text,
	"enforce_tfa" boolean DEFAULT false NOT NULL,
	"admin_access" boolean DEFAULT false NOT NULL,
	"app_access" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directus_deployment_projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deployment" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"date_created" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"user_created" uuid
);
--> statement-breakpoint
CREATE TABLE "directus_operations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"key" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"position_x" integer NOT NULL,
	"position_y" integer NOT NULL,
	"options" json,
	"resolve" uuid,
	"reject" uuid,
	"flow" uuid NOT NULL,
	"date_created" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"user_created" uuid,
	CONSTRAINT "directus_operations_resolve_unique" UNIQUE("resolve"),
	CONSTRAINT "directus_operations_reject_unique" UNIQUE("reject")
);
--> statement-breakpoint
CREATE TABLE "directus_sessions" (
	"token" varchar(64) PRIMARY KEY NOT NULL,
	"user" uuid,
	"expires" timestamp(6) with time zone NOT NULL,
	"ip" varchar(255),
	"user_agent" text,
	"share" uuid,
	"origin" varchar(255),
	"next_token" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "profile_version_extensions" (
	"id" serial PRIMARY KEY NOT NULL,
	"extender_id" integer,
	"extended_id" integer
);
--> statement-breakpoint
CREATE TABLE "side_project_achievements" (
	"id" integer PRIMARY KEY DEFAULT nextval('side_project_achievements_id_seq'::regclass) NOT NULL,
	"description" varchar(255),
	"side_project_id" integer NOT NULL,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"sort" integer
);
--> statement-breakpoint
CREATE TABLE "work_experiences" (
	"name" text NOT NULL,
	"location" text NOT NULL,
	"description" text NOT NULL,
	"position" text NOT NULL,
	"summary" text NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"logo_id" uuid,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"sort" integer,
	"profile_id" integer NOT NULL,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"start_date" date,
	"end_date" date,
	"website" varchar(255),
	"tags" json,
	"logo_path" varchar(255),
	"banner_path" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"date_created" timestamp(6) with time zone,
	"date_updated" timestamp(6) with time zone,
	"job_id" integer,
	"profile_id" integer NOT NULL,
	"cv_sent_through" varchar(255),
	"cv_file_sent_id" uuid,
	"application_sent_date" date,
	"discontinued_reason" varchar(255),
	"discontinued_note" text,
	"application_note" text,
	"application_seen_date" date,
	"salary_expectation" numeric(10, 2),
	"salary_currency" varchar(255) DEFAULT 'EUR',
	"salary_period" varchar(255),
	"status_step" varchar(255),
	"status_action" varchar(255),
	"status_action_date" date,
	"cv_version_sent" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"date_created" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"expires_at" timestamp(6) with time zone,
	"last_used" timestamp(6) with time zone,
	"revoked" boolean DEFAULT false NOT NULL,
	"key_plain" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "search_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(50) DEFAULT 'idle',
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"profile_id" integer NOT NULL,
	"last_run" timestamp with time zone,
	"search_url" text,
	"platform_id" integer,
	"navigation_type" varchar(255) DEFAULT NULL,
	"stripped_html" text,
	"last_run_jobs_found" integer,
	"live_url" varchar(500) DEFAULT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"status_message" varchar(255) DEFAULT NULL,
	"platform_profile_id" integer,
	"max_jobs" integer,
	"browser_provider" varchar(20) DEFAULT NULL,
	"search_term" varchar(500) DEFAULT NULL,
	"skip_existing" boolean DEFAULT false NOT NULL,
	"skip_first" integer,
	"stop_after_duplicates" integer,
	"keep_minimized" boolean DEFAULT true,
	"ui_preferences" jsonb DEFAULT '{}'::jsonb,
	"extracted_jobs_json" text,
	"note" varchar(500),
	"schedule_interval_hours" integer,
	"next_scheduled_run" timestamp(6) with time zone,
	"tunnel_api_key" integer,
	"login_mode" varchar(10) DEFAULT 'auto' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp(6) with time zone,
	"date_updated" timestamp(6) with time zone,
	"profile_id" integer NOT NULL,
	"system_prompt" text NOT NULL,
	"user_prompt" text NOT NULL,
	"full_prompt" text,
	"response" text,
	"context" json,
	"followup_to" integer,
	"error" text,
	"provider" varchar(255),
	"model" varchar(255),
	"request_type" varchar(255),
	"ai_chat_template" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"credits_charged" integer
);
--> statement-breakpoint
CREATE TABLE "search_tasks_job_sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"search_tasks_id" integer
);
--> statement-breakpoint
CREATE TABLE "scraper_agent_iterations" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"iteration" integer NOT NULL,
	"run_id" integer,
	"run_status" varchar(50),
	"items_total" integer,
	"items_completed" integer,
	"items_error" integer,
	"success_pct" double precision,
	"claude_analysis" text,
	"claude_changes" text,
	"started_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"finished_at" timestamp(6) with time zone,
	"stage" varchar(30),
	"goal_evaluation" text,
	"goal_met" boolean,
	"prompt" text
);
--> statement-breakpoint
CREATE TABLE "scraper_agent_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"search_task_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"max_iterations" integer DEFAULT 10 NOT NULL,
	"current_iteration" integer DEFAULT 0 NOT NULL,
	"claude_session_id" varchar(255),
	"system_prompt" text,
	"error_message" text,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"finished_at" timestamp(6) with time zone,
	"run_first" boolean DEFAULT false NOT NULL,
	"goal" text NOT NULL,
	"pending_hint" text,
	"needs_input" text
);
--> statement-breakpoint
CREATE TABLE "import_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"user_email" varchar(255),
	"profile_id" integer,
	"event" varchar(50) NOT NULL,
	"file_name" varchar(255),
	"file_format" varchar(50),
	"doc_type" varchar(20),
	"sections" json,
	"changes" json,
	"error" text,
	"parsed_data" json,
	"file_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "job_statuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(255) DEFAULT 'new' NOT NULL,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"job" integer NOT NULL,
	"profile" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"name" varchar(255) DEFAULT NULL,
	"title" varchar(255) DEFAULT NULL,
	"phone_number" varchar(255) DEFAULT NULL,
	"email_address" varchar(255) DEFAULT NULL,
	"personal_website" varchar(255),
	"subtitle" varchar(255) DEFAULT NULL,
	"core_stack" varchar(255) DEFAULT NULL,
	"linkedin_profile" varchar(255),
	"github_profile" varchar(255),
	"stackoverflow_profile" varchar(255),
	"headline" varchar(255),
	"profile_picture_id" uuid,
	"summary" text,
	"nationality" varchar(255) DEFAULT NULL,
	"location_url" varchar(255),
	"location_timezone" varchar(255),
	"sort" integer,
	"city" varchar(255),
	"region" varchar(255),
	"country_code" varchar(10),
	"is_default" boolean DEFAULT false,
	"slug" varchar(255),
	"npm_profile" varchar(255),
	"pypi_profile" varchar(255),
	"company_name" varchar(255),
	"street_address" varchar(255),
	"postal_code" varchar(20),
	"vat_id" varchar(50),
	"kvk_number" varchar(50),
	"about_me_text" text,
	"meta_image_url" varchar(500),
	"dev_start_year" integer,
	"python_js_start_year" integer,
	"remote_start_year" integer,
	"signal_profile" varchar(500),
	"whatsapp_number" varchar(50),
	"telegram_username" varchar(100),
	"user_id" text,
	"public_cv_version_id" integer,
	"public_resume_version_id" integer,
	"source_cv" uuid,
	"location" varchar(255),
	"profile_photo_path" varchar(255),
	"browser_user_agent" varchar(500),
	"browser_language" varchar(50),
	"browser_timezone" varchar(100),
	"ui_preferences" jsonb DEFAULT '{}'::jsonb,
	"browser_country_code" varchar(10),
	"browser_profile_id" varchar(100),
	"salary_base_rate" integer,
	"salary_currency" varchar(10) DEFAULT 'EUR',
	"salary_adjustments" json,
	"salary_region_overrides" json,
	CONSTRAINT "profiles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "application_letters" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp(6) with time zone,
	"date_updated" timestamp(6) with time zone,
	"application_id" integer NOT NULL,
	"letter_type" varchar(255) DEFAULT 'cover_letter' NOT NULL,
	"content" text,
	"ai_chat_id" integer,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"ai_chat_response" text
);
--> statement-breakpoint
CREATE TABLE "application_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"sort" integer,
	"date_created" timestamp(6) with time zone,
	"date_updated" timestamp(6) with time zone,
	"application_id" integer NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"ai_chat_id" integer,
	"ai_chat_response" text
);
--> statement-breakpoint
CREATE TABLE "application_status_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp(6) with time zone,
	"application" integer NOT NULL,
	"from_status" varchar(255),
	"to_status" varchar(255) NOT NULL,
	"description" text,
	"step" varchar(255),
	"action" varchar(255),
	"action_date" date
);
--> statement-breakpoint
CREATE TABLE "letter_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp(6) with time zone DEFAULT now(),
	"letter" integer NOT NULL,
	"content" text,
	"source" varchar(255) NOT NULL,
	"ai_chat" integer,
	"ai_feedback" text,
	"user_request" text
);
--> statement-breakpoint
CREATE TABLE "job_match_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"job" integer NOT NULL,
	"profile" integer NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"skill_match_percentage" integer,
	"recommendation" varchar(255),
	"match_summary" text,
	"date_created" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_importers" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"job" integer NOT NULL,
	"profile" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_feedback_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_feedback_id" integer NOT NULL,
	"file_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"profile_id" integer,
	"category" varchar(50) DEFAULT 'other' NOT NULL,
	"message" text NOT NULL,
	"page_url" varchar(1000),
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"admin_note" text,
	"date_created" timestamp(6) with time zone DEFAULT now(),
	"date_updated" timestamp(6) with time zone,
	"merged_into_id" integer
);
--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_customer_id" varchar(255) NOT NULL,
	"date_created" timestamp(6) with time zone DEFAULT now(),
	CONSTRAINT "billing_customers_user_id_key" UNIQUE("user_id"),
	CONSTRAINT "billing_customers_stripe_customer_id_key" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_subscription_id" varchar(255) NOT NULL,
	"stripe_price_id" varchar(255) NOT NULL,
	"plan" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp(6) with time zone NOT NULL,
	"current_period_end" timestamp(6) with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"date_created" timestamp(6) with time zone DEFAULT now(),
	"date_updated" timestamp(6) with time zone,
	CONSTRAINT "subscriptions_stripe_subscription_id_key" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "credit_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"pack_type" varchar(50) NOT NULL,
	"amount_cents" integer NOT NULL,
	"period" varchar(7) NOT NULL,
	"date_created" timestamp(6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period" varchar(7) NOT NULL,
	"ai_generations" integer DEFAULT 0 NOT NULL,
	"ai_followups" integer DEFAULT 0 NOT NULL,
	"job_matches" integer DEFAULT 0 NOT NULL,
	"scrape_runs" integer DEFAULT 0 NOT NULL,
	"pdf_exports" integer DEFAULT 0 NOT NULL,
	"resume_parses" integer DEFAULT 0 NOT NULL,
	"extra_ai_generations" integer DEFAULT 0 NOT NULL,
	"extra_ai_followups" integer DEFAULT 0 NOT NULL,
	"extra_job_matches" integer DEFAULT 0 NOT NULL,
	"extra_scrape_runs" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_counters_user_id_period_key" UNIQUE("user_id","period")
);
--> statement-breakpoint
CREATE TABLE "verification_email_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"email_token" varchar(64) NOT NULL,
	"full_address" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_used_at" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "credit_balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period" varchar(10) NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"credits_allowance" integer DEFAULT 0 NOT NULL,
	"extra_credits" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "credit_balances_user_id_period_key" UNIQUE("user_id","period")
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer,
	"operation" varchar(100) NOT NULL,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(255) DEFAULT 'draft' NOT NULL,
	"sort" integer,
	"date_created" timestamp(6) with time zone,
	"date_updated" timestamp(6) with time zone,
	"name" varchar(255) NOT NULL,
	"issuer" varchar(255),
	"date" date,
	"url" varchar(255),
	"profile" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"verification_address_id" integer,
	"run_id" integer,
	"from_address" varchar(255) NOT NULL,
	"subject" varchar(500),
	"body_text" text,
	"body_html" text,
	"extracted_code" varchar(50),
	"extracted_link" varchar(2000),
	"status" varchar(20) DEFAULT 'received' NOT NULL,
	"received_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"applied_at" timestamp(6) with time zone,
	"recipient" varchar(255) NOT NULL,
	"handler" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"date_created" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"date_updated" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "device_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"api_key_id" integer NOT NULL,
	"shared_with" text NOT NULL,
	"date_created" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "feedback_replies" (
	"id" serial PRIMARY KEY NOT NULL,
	"feedback_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_feedback_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"feedback_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"subscribed_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text,
	"link" varchar(500),
	"read_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"storage" varchar(255) NOT NULL,
	"filename_disk" varchar(255),
	"filename_download" varchar(255) NOT NULL,
	"title" varchar(255),
	"type" varchar(255),
	"folder" uuid,
	"uploaded_by" uuid,
	"modified_by" uuid,
	"charset" varchar(50),
	"filesize" bigint,
	"width" integer,
	"height" integer,
	"duration" integer,
	"embed" varchar(200),
	"description" text,
	"location" text,
	"tags" text,
	"metadata" json,
	"focal_point_x" integer,
	"focal_point_y" integer,
	"tus_id" varchar(64),
	"tus_data" json,
	"uploaded_on" timestamp with time zone,
	"created_on" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"modified_on" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_prompts" ADD CONSTRAINT "ai_prompts_user_created_foreign" FOREIGN KEY ("user_created") REFERENCES "public"."directus_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_prompts" ADD CONSTRAINT "ai_prompts_user_updated_foreign" FOREIGN KEY ("user_updated") REFERENCES "public"."directus_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_activity_log" ADD CONSTRAINT "application_activity_log_application_foreign" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications_files" ADD CONSTRAINT "applications_files_applications_id_foreign" FOREIGN KEY ("applications_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications_files" ADD CONSTRAINT "applications_files_file_id_foreign" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collected_data" ADD CONSTRAINT "collected_data_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_comments" ADD CONSTRAINT "directus_comments_user_created_foreign" FOREIGN KEY ("user_created") REFERENCES "public"."directus_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_comments" ADD CONSTRAINT "directus_comments_user_updated_foreign" FOREIGN KEY ("user_updated") REFERENCES "public"."directus_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_dashboards" ADD CONSTRAINT "directus_dashboards_user_created_foreign" FOREIGN KEY ("user_created") REFERENCES "public"."directus_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_deployments" ADD CONSTRAINT "directus_deployments_user_created_foreign" FOREIGN KEY ("user_created") REFERENCES "public"."directus_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_deployment_runs" ADD CONSTRAINT "directus_deployment_runs_project_foreign" FOREIGN KEY ("project") REFERENCES "public"."directus_deployment_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_deployment_runs" ADD CONSTRAINT "directus_deployment_runs_user_created_foreign" FOREIGN KEY ("user_created") REFERENCES "public"."directus_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "config_default_profile_foreign" FOREIGN KEY ("default_profile") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_access" ADD CONSTRAINT "directus_access_policy_foreign" FOREIGN KEY ("policy") REFERENCES "public"."directus_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_access" ADD CONSTRAINT "directus_access_role_foreign" FOREIGN KEY ("role") REFERENCES "public"."directus_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_access" ADD CONSTRAINT "directus_access_user_foreign" FOREIGN KEY ("user") REFERENCES "public"."directus_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_collections" ADD CONSTRAINT "directus_collections_group_foreign" FOREIGN KEY ("group") REFERENCES "public"."directus_collections"("collection") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_folders" ADD CONSTRAINT "directus_folders_parent_foreign" FOREIGN KEY ("parent") REFERENCES "public"."directus_folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_notifications" ADD CONSTRAINT "directus_notifications_recipient_foreign" FOREIGN KEY ("recipient") REFERENCES "public"."directus_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_notifications" ADD CONSTRAINT "directus_notifications_sender_foreign" FOREIGN KEY ("sender") REFERENCES "public"."directus_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_flows" ADD CONSTRAINT "directus_flows_user_created_foreign" FOREIGN KEY ("user_created") REFERENCES "public"."directus_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_presets" ADD CONSTRAINT "directus_presets_role_foreign" FOREIGN KEY ("role") REFERENCES "public"."directus_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_presets" ADD CONSTRAINT "directus_presets_user_foreign" FOREIGN KEY ("user") REFERENCES "public"."directus_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_panels" ADD CONSTRAINT "directus_panels_dashboard_foreign" FOREIGN KEY ("dashboard") REFERENCES "public"."directus_dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_panels" ADD CONSTRAINT "directus_panels_user_created_foreign" FOREIGN KEY ("user_created") REFERENCES "public"."directus_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_revisions" ADD CONSTRAINT "directus_revisions_activity_foreign" FOREIGN KEY ("activity") REFERENCES "public"."directus_activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_revisions" ADD CONSTRAINT "directus_revisions_parent_foreign" FOREIGN KEY ("parent") REFERENCES "public"."directus_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_revisions" ADD CONSTRAINT "directus_revisions_version_foreign" FOREIGN KEY ("version") REFERENCES "public"."directus_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_permissions" ADD CONSTRAINT "directus_permissions_policy_foreign" FOREIGN KEY ("policy") REFERENCES "public"."directus_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_versions" ADD CONSTRAINT "directus_versions_collection_foreign" FOREIGN KEY ("collection") REFERENCES "public"."directus_collections"("collection") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_versions" ADD CONSTRAINT "directus_versions_user_created_foreign" FOREIGN KEY ("user_created") REFERENCES "public"."directus_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_versions" ADD CONSTRAINT "directus_versions_user_updated_foreign" FOREIGN KEY ("user_updated") REFERENCES "public"."directus_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_settings" ADD CONSTRAINT "directus_settings_project_logo_foreign" FOREIGN KEY ("project_logo") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_settings" ADD CONSTRAINT "directus_settings_public_background_foreign" FOREIGN KEY ("public_background") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_settings" ADD CONSTRAINT "directus_settings_public_favicon_foreign" FOREIGN KEY ("public_favicon") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_settings" ADD CONSTRAINT "directus_settings_public_foreground_foreign" FOREIGN KEY ("public_foreground") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_settings" ADD CONSTRAINT "directus_settings_public_registration_role_foreign" FOREIGN KEY ("public_registration_role") REFERENCES "public"."directus_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_settings" ADD CONSTRAINT "directus_settings_storage_default_folder_foreign" FOREIGN KEY ("storage_default_folder") REFERENCES "public"."directus_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education" ADD CONSTRAINT "education_logo_foreign" FOREIGN KEY ("logo_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education" ADD CONSTRAINT "education_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_roles" ADD CONSTRAINT "directus_roles_parent_foreign" FOREIGN KEY ("parent") REFERENCES "public"."directus_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_shares" ADD CONSTRAINT "directus_shares_collection_foreign" FOREIGN KEY ("collection") REFERENCES "public"."directus_collections"("collection") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_shares" ADD CONSTRAINT "directus_shares_role_foreign" FOREIGN KEY ("role") REFERENCES "public"."directus_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_shares" ADD CONSTRAINT "directus_shares_user_created_foreign" FOREIGN KEY ("user_created") REFERENCES "public"."directus_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_config" ADD CONSTRAINT "match_config_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_ai_chat_scoring_foreign" FOREIGN KEY ("ai_chat_scoring") REFERENCES "public"."ai_chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_job_foreign" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_users" ADD CONSTRAINT "directus_users_role_foreign" FOREIGN KEY ("role") REFERENCES "public"."directus_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_resources" ADD CONSTRAINT "job_resources_file_foreign" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_resources" ADD CONSTRAINT "job_resources_job_foreign" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_task_runs" ADD CONSTRAINT "search_task_runs_search_task_id_fkey" FOREIGN KEY ("search_task_id") REFERENCES "public"."search_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os_contributions" ADD CONSTRAINT "os_contributions_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_profiles" ADD CONSTRAINT "platform_profiles_platform_foreign" FOREIGN KEY ("platform_id") REFERENCES "public"."job_platforms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_profiles" ADD CONSTRAINT "platform_profiles_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "languages" ADD CONSTRAINT "languages_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_task_run_items" ADD CONSTRAINT "job_search_run_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_task_run_items" ADD CONSTRAINT "search_task_run_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."search_task_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_ai_chat_extraction_foreign" FOREIGN KEY ("ai_chat_extraction") REFERENCES "public"."ai_chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_job_platform_foreign" FOREIGN KEY ("job_platform_id") REFERENCES "public"."job_platforms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stories" ADD CONSTRAINT "project_stories_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_exports" ADD CONSTRAINT "profile_exports_file_foreign" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_exports" ADD CONSTRAINT "profile_exports_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "references" ADD CONSTRAINT "references_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraper_logs" ADD CONSTRAINT "scraper_logs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."search_task_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_expectations" ADD CONSTRAINT "salary_expectations_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_versions" ADD CONSTRAINT "profile_versions_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "side_project_technologies" ADD CONSTRAINT "side_project_technologies_side_project_foreign" FOREIGN KEY ("side_project_id") REFERENCES "public"."side_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_experience_achievements" ADD CONSTRAINT "work_experience_achievements_work_experience_foreign" FOREIGN KEY ("work_experience_id") REFERENCES "public"."work_experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "session_userid_foreign" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_experience_projects" ADD CONSTRAINT "work_experience_projects_work_experience_foreign" FOREIGN KEY ("work_experience_id") REFERENCES "public"."work_experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_experience_technologies" ADD CONSTRAINT "work_experience_technologies_work_experience_foreign" FOREIGN KEY ("work_experience_id") REFERENCES "public"."work_experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "side_projects" ADD CONSTRAINT "side_projects_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tech_skill_categories" ADD CONSTRAINT "tech_skill_categories_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_experience_project_technologies" ADD CONSTRAINT "work_experience_project_technologies_work___27d59b1f_foreign" FOREIGN KEY ("work_experience_project_id") REFERENCES "public"."work_experience_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tech_skills" ADD CONSTRAINT "tech_skills_category_foreign" FOREIGN KEY ("category_id") REFERENCES "public"."tech_skill_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tech_skills" ADD CONSTRAINT "tech_skills_tech_type_foreign" FOREIGN KEY ("tech_type_id") REFERENCES "public"."tech_skill_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "account_userid_foreign" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheat_sheets" ADD CONSTRAINT "cheat_sheets_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_deployment_projects" ADD CONSTRAINT "directus_deployment_projects_deployment_foreign" FOREIGN KEY ("deployment") REFERENCES "public"."directus_deployments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_deployment_projects" ADD CONSTRAINT "directus_deployment_projects_user_created_foreign" FOREIGN KEY ("user_created") REFERENCES "public"."directus_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_operations" ADD CONSTRAINT "directus_operations_flow_foreign" FOREIGN KEY ("flow") REFERENCES "public"."directus_flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_operations" ADD CONSTRAINT "directus_operations_reject_foreign" FOREIGN KEY ("reject") REFERENCES "public"."directus_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_operations" ADD CONSTRAINT "directus_operations_resolve_foreign" FOREIGN KEY ("resolve") REFERENCES "public"."directus_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_operations" ADD CONSTRAINT "directus_operations_user_created_foreign" FOREIGN KEY ("user_created") REFERENCES "public"."directus_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_sessions" ADD CONSTRAINT "directus_sessions_share_foreign" FOREIGN KEY ("share") REFERENCES "public"."directus_shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directus_sessions" ADD CONSTRAINT "directus_sessions_user_foreign" FOREIGN KEY ("user") REFERENCES "public"."directus_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_version_extensions" ADD CONSTRAINT "profile_version_extensions_extended_foreign" FOREIGN KEY ("extended_id") REFERENCES "public"."profile_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_version_extensions" ADD CONSTRAINT "profile_version_extensions_extender_foreign" FOREIGN KEY ("extender_id") REFERENCES "public"."profile_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "side_project_achievements" ADD CONSTRAINT "side_project_achievements_side_project_foreign" FOREIGN KEY ("side_project_id") REFERENCES "public"."side_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD CONSTRAINT "work_experiences_logo_foreign" FOREIGN KEY ("logo_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD CONSTRAINT "work_experiences_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_cv_file_sent_foreign" FOREIGN KEY ("cv_file_sent_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_foreign" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_tasks" ADD CONSTRAINT "search_tasks_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_tasks" ADD CONSTRAINT "search_tasks_platform_foreign" FOREIGN KEY ("platform_id") REFERENCES "public"."job_platforms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_tasks" ADD CONSTRAINT "search_tasks_platform_profile_id_fkey" FOREIGN KEY ("platform_profile_id") REFERENCES "public"."platform_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_tasks" ADD CONSTRAINT "search_tasks_tunnel_api_key_fkey" FOREIGN KEY ("tunnel_api_key") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chats" ADD CONSTRAINT "ai_chats_ai_chat_template_foreign" FOREIGN KEY ("ai_chat_template") REFERENCES "public"."ai_chat_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chats" ADD CONSTRAINT "ai_chats_followup_to_foreign" FOREIGN KEY ("followup_to") REFERENCES "public"."ai_chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chats" ADD CONSTRAINT "ai_chats_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_tasks_job_sites" ADD CONSTRAINT "search_tasks_job_sites_search_tasks_id_foreign" FOREIGN KEY ("search_tasks_id") REFERENCES "public"."search_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraper_agent_iterations" ADD CONSTRAINT "scraper_agent_iterations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."scraper_agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraper_agent_iterations" ADD CONSTRAINT "scraper_agent_iterations_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."search_task_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraper_agent_sessions" ADD CONSTRAINT "scraper_agent_sessions_search_task_id_fkey" FOREIGN KEY ("search_task_id") REFERENCES "public"."search_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_statuses" ADD CONSTRAINT "job_statuses_job_fkey" FOREIGN KEY ("job") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_statuses" ADD CONSTRAINT "job_statuses_profile_fkey" FOREIGN KEY ("profile") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_profile_picture_foreign" FOREIGN KEY ("profile_picture_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_public_cv_version_foreign" FOREIGN KEY ("public_cv_version_id") REFERENCES "public"."profile_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_public_resume_version_foreign" FOREIGN KEY ("public_resume_version_id") REFERENCES "public"."profile_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_letters" ADD CONSTRAINT "application_letters_ai_chat_foreign" FOREIGN KEY ("ai_chat_id") REFERENCES "public"."ai_chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_letters" ADD CONSTRAINT "application_letters_application_foreign" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_questions" ADD CONSTRAINT "application_questions_ai_chat_foreign" FOREIGN KEY ("ai_chat_id") REFERENCES "public"."ai_chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_questions" ADD CONSTRAINT "application_questions_application_foreign" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_status_log" ADD CONSTRAINT "application_status_log_application_foreign" FOREIGN KEY ("application") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_versions" ADD CONSTRAINT "letter_versions_ai_chat_foreign" FOREIGN KEY ("ai_chat") REFERENCES "public"."ai_chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_versions" ADD CONSTRAINT "letter_versions_letter_foreign" FOREIGN KEY ("letter") REFERENCES "public"."application_letters"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "job_match_history" ADD CONSTRAINT "job_match_history_job_foreign" FOREIGN KEY ("job") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_match_history" ADD CONSTRAINT "job_match_history_profile_foreign" FOREIGN KEY ("profile") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_importers" ADD CONSTRAINT "job_importers_job_foreign" FOREIGN KEY ("job") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_importers" ADD CONSTRAINT "job_importers_profile_foreign" FOREIGN KEY ("profile") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback_files" ADD CONSTRAINT "user_feedback_files_user_feedback_id_fkey" FOREIGN KEY ("user_feedback_id") REFERENCES "public"."user_feedback"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_feedback_files" ADD CONSTRAINT "user_feedback_files_directus_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "public"."user_feedback"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "verification_email_addresses" ADD CONSTRAINT "verification_email_addresses_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_profile_foreign" FOREIGN KEY ("profile") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_address_fkey" FOREIGN KEY ("verification_address_id") REFERENCES "public"."verification_email_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_run_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."search_task_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_shares" ADD CONSTRAINT "device_shares_shared_with_fkey" FOREIGN KEY ("shared_with") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_shares" ADD CONSTRAINT "device_shares_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_replies" ADD CONSTRAINT "feedback_replies_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "public"."user_feedback"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_feedback_subscribers" ADD CONSTRAINT "user_feedback_subscribers_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "public"."user_feedback"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "directus_files_folder_foreign" FOREIGN KEY ("folder") REFERENCES "public"."directus_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "directus_files_modified_by_foreign" FOREIGN KEY ("modified_by") REFERENCES "public"."directus_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "directus_files_uploaded_by_foreign" FOREIGN KEY ("uploaded_by") REFERENCES "public"."directus_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_prompts_name_index" ON "ai_prompts" USING btree ("name" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ai_prompts_name_unique" ON "ai_prompts" USING btree ("name" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "directus_deployments_provider_unique" ON "directus_deployments" USING btree ("provider" text_ops);--> statement-breakpoint
CREATE INDEX "directus_activity_timestamp_index" ON "directus_activity" USING btree ("timestamp" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "directus_revisions_activity_index" ON "directus_revisions" USING btree ("activity" int4_ops);--> statement-breakpoint
CREATE INDEX "directus_revisions_parent_index" ON "directus_revisions" USING btree ("parent" int4_ops);--> statement-breakpoint
CREATE INDEX "job_matches_profile_id_job_id_idx" ON "job_matches" USING btree ("profile_id" int4_ops,"job_id" int4_ops);--> statement-breakpoint
CREATE INDEX "search_task_runs_search_task_id_started_at_idx" ON "search_task_runs" USING btree ("search_task_id" int4_ops,"started_at" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_search_task_run_items_run_id" ON "search_task_run_items" USING btree ("run_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_search_task_run_items_run_status" ON "search_task_run_items" USING btree ("run_id" int4_ops,"status" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_jobs_uniqueness" ON "jobs" USING btree ("title" date_ops,"job_poster" date_ops,"date_posted" text_ops);--> statement-breakpoint
CREATE INDEX "jobs_source_url_idx" ON "jobs" USING btree ("source_url" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "profile_tokens_token_hash_unique" ON "profile_tokens" USING btree ("token_hash" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "profile_tokens_token_unique" ON "profile_tokens" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "scraper_logs_run_id_timestamp_idx" ON "scraper_logs" USING btree ("run_id" int4_ops,"timestamp" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "tech_skill_types_slug_key" ON "tech_skill_types" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_unique" ON "sessions" USING btree ("token" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "directus_deployment_projects_deployment_external_id_unique" ON "directus_deployment_projects" USING btree ("deployment" text_ops,"external_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys" USING btree ("key_hash" text_ops);--> statement-breakpoint
CREATE INDEX "idx_api_keys_hash" ON "api_keys" USING btree ("key_hash" text_ops);--> statement-breakpoint
CREATE INDEX "idx_api_keys_profile" ON "api_keys" USING btree ("profile_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_search_tasks_platform_profile" ON "search_tasks" USING btree ("platform_profile_id" int4_ops);--> statement-breakpoint
CREATE INDEX "scraper_agent_iterations_session_id_iteration_idx" ON "scraper_agent_iterations" USING btree ("session_id" int4_ops,"iteration" int4_ops);--> statement-breakpoint
CREATE INDEX "scraper_agent_sessions_search_task_id_idx" ON "scraper_agent_sessions" USING btree ("search_task_id" int4_ops);--> statement-breakpoint
CREATE INDEX "scraper_agent_sessions_status_idx" ON "scraper_agent_sessions" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "import_logs_date_created_idx" ON "import_logs" USING btree ("date_created" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "import_logs_user_id_idx" ON "import_logs" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "job_statuses_profile_job_key" ON "job_statuses" USING btree ("profile" int4_ops,"job" int4_ops);--> statement-breakpoint
CREATE INDEX "job_statuses_profile_status_idx" ON "job_statuses" USING btree ("profile" int4_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "profiles_user_id_idx" ON "profiles" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "job_match_history_date_idx" ON "job_match_history" USING btree ("job" int4_ops,"date_created" int4_ops);--> statement-breakpoint
CREATE INDEX "job_match_history_profile_job_idx" ON "job_match_history" USING btree ("profile" int4_ops,"job" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "job_importers_job_profile_unique" ON "job_importers" USING btree ("job" int4_ops,"profile" int4_ops);--> statement-breakpoint
CREATE INDEX "user_feedback_files_feedback_idx" ON "user_feedback_files" USING btree ("user_feedback_id" int4_ops);--> statement-breakpoint
CREATE INDEX "user_feedback_category_idx" ON "user_feedback" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "user_feedback_date_created_idx" ON "user_feedback" USING btree ("date_created" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "user_feedback_merged_into_idx" ON "user_feedback" USING btree ("merged_into_id" int4_ops);--> statement-breakpoint
CREATE INDEX "user_feedback_status_idx" ON "user_feedback" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "user_feedback_user_id_idx" ON "user_feedback" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "credit_purchases_user_id_idx" ON "credit_purchases" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "usage_counters_period_idx" ON "usage_counters" USING btree ("period" text_ops);--> statement-breakpoint
CREATE INDEX "usage_counters_user_id_idx" ON "usage_counters" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_verification_email_addresses_token" ON "verification_email_addresses" USING btree ("email_token" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "verification_email_addresses_email_token_key" ON "verification_email_addresses" USING btree ("email_token" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "verification_email_addresses_profile_id_key" ON "verification_email_addresses" USING btree ("profile_id" int4_ops);--> statement-breakpoint
CREATE INDEX "credit_balances_user_id_idx" ON "credit_balances" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "credit_transactions_operation_idx" ON "credit_transactions" USING btree ("operation" text_ops);--> statement-breakpoint
CREATE INDEX "credit_transactions_user_id_created_idx" ON "credit_transactions" USING btree ("user_id" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_certificates_profile" ON "certificates" USING btree ("profile" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_inbound_emails_address" ON "inbound_emails" USING btree ("verification_address_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_inbound_emails_handler" ON "inbound_emails" USING btree ("handler" text_ops);--> statement-breakpoint
CREATE INDEX "idx_inbound_emails_received" ON "inbound_emails" USING btree ("received_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_inbound_emails_run" ON "inbound_emails" USING btree ("run_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_inbound_emails_status" ON "inbound_emails" USING btree ("status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_pair_unique" ON "contacts" USING btree ("requester_id" text_ops,"recipient_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_recipient" ON "contacts" USING btree ("recipient_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_contacts_requester" ON "contacts" USING btree ("requester_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "device_shares_key_user_unique" ON "device_shares" USING btree ("api_key_id" text_ops,"shared_with" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_device_shares_api_key" ON "device_shares" USING btree ("api_key_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_device_shares_shared_with" ON "device_shares" USING btree ("shared_with" text_ops);--> statement-breakpoint
CREATE INDEX "feedback_replies_feedback_idx" ON "feedback_replies" USING btree ("feedback_id" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "user_feedback_subscribers_unique" ON "user_feedback_subscribers" USING btree ("feedback_id" int4_ops,"user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "user_feedback_subscribers_user_idx" ON "user_feedback_subscribers" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id" text_ops,"read_at" text_ops);
*/