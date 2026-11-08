CREATE TABLE "application_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"rendition_id" uuid NOT NULL,
	"date_uploaded" date NOT NULL,
	"date_created" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"kind" varchar(16) DEFAULT 'other' NOT NULL,
	"label" varchar(255),
	"file_id" uuid NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"format" varchar(8) NOT NULL,
	"has_alpha" boolean DEFAULT false NOT NULL,
	"orientation" smallint DEFAULT 1 NOT NULL,
	"replaces_id" integer,
	"template_id" integer,
	"date_created" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media_presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer,
	"key" varchar(64),
	"platform" varchar(100) NOT NULL,
	"slot" varchar(100) NOT NULL,
	"kind" varchar(16) DEFAULT 'other' NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"formats" jsonb DEFAULT '["jpeg","png"]'::jsonb NOT NULL,
	"max_bytes" integer,
	"mask" varchar(16) DEFAULT 'none' NOT NULL,
	"safe_zone" jsonb,
	"note" text,
	"source_url" varchar(500),
	"verified_on" date,
	"sort" integer,
	"date_created" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media_renditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" integer NOT NULL,
	"preset_id" integer,
	"crop_x" integer NOT NULL,
	"crop_y" integer NOT NULL,
	"crop_w" integer NOT NULL,
	"crop_h" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"format" varchar(8) NOT NULL,
	"quality" smallint,
	"file_id" uuid,
	"date_created" timestamp with time zone,
	CONSTRAINT "media_renditions_identity_key" UNIQUE NULLS NOT DISTINCT("item_id","preset_id","crop_x","crop_y","crop_w","crop_h","width","height","format")
);
--> statement-breakpoint
ALTER TABLE "presentation_template_assets" ALTER COLUMN "file_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "education" ADD COLUMN "logo_id" uuid;--> statement-breakpoint
ALTER TABLE "education" ADD COLUMN "banner_id" uuid;--> statement-breakpoint
ALTER TABLE "presentation_template_assets" ADD COLUMN "rendition_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "profile_photo_id" uuid;--> statement-breakpoint
ALTER TABLE "side_projects" ADD COLUMN "image_id" uuid;--> statement-breakpoint
ALTER TABLE "side_projects" ADD COLUMN "banner_id" uuid;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "logo_id" uuid;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD COLUMN "banner_id" uuid;--> statement-breakpoint
ALTER TABLE "application_media" ADD CONSTRAINT "application_media_application_foreign" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_media" ADD CONSTRAINT "application_media_rendition_foreign" FOREIGN KEY ("rendition_id") REFERENCES "public"."media_renditions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_replaces_id_media_items_id_fk" FOREIGN KEY ("replaces_id") REFERENCES "public"."media_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_template_id_presentation_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."presentation_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_file_foreign" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_presets" ADD CONSTRAINT "media_presets_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_renditions" ADD CONSTRAINT "media_renditions_item_foreign" FOREIGN KEY ("item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_renditions" ADD CONSTRAINT "media_renditions_preset_foreign" FOREIGN KEY ("preset_id") REFERENCES "public"."media_presets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_renditions" ADD CONSTRAINT "media_renditions_file_foreign" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_media_application_idx" ON "application_media" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_media_rendition_idx" ON "application_media" USING btree ("rendition_id");--> statement-breakpoint
CREATE INDEX "media_items_profile_idx" ON "media_items" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "media_items_file_idx" ON "media_items" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "media_items_replaces_idx" ON "media_items" USING btree ("replaces_id");--> statement-breakpoint
CREATE INDEX "media_items_template_idx" ON "media_items" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_presets_shared_key" ON "media_presets" USING btree ("key") WHERE profile_id IS NULL;--> statement-breakpoint
CREATE INDEX "media_presets_profile_idx" ON "media_presets" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "media_renditions_preset_idx" ON "media_renditions" USING btree ("preset_id");--> statement-breakpoint
CREATE INDEX "media_renditions_file_idx" ON "media_renditions" USING btree ("file_id");--> statement-breakpoint
ALTER TABLE "education" ADD CONSTRAINT "education_logo_id_media_renditions_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media_renditions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education" ADD CONSTRAINT "education_banner_id_media_renditions_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."media_renditions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_template_assets" ADD CONSTRAINT "presentation_template_assets_rendition_foreign" FOREIGN KEY ("rendition_id") REFERENCES "public"."media_renditions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_profile_photo_id_media_renditions_id_fk" FOREIGN KEY ("profile_photo_id") REFERENCES "public"."media_renditions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "side_projects" ADD CONSTRAINT "side_projects_image_id_media_renditions_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media_renditions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "side_projects" ADD CONSTRAINT "side_projects_banner_id_media_renditions_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."media_renditions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD CONSTRAINT "work_experiences_logo_id_media_renditions_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media_renditions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD CONSTRAINT "work_experiences_banner_id_media_renditions_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."media_renditions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "education_logo_idx" ON "education" USING btree ("logo_id");--> statement-breakpoint
CREATE INDEX "education_banner_idx" ON "education" USING btree ("banner_id");--> statement-breakpoint
CREATE INDEX "presentation_template_assets_rendition_idx" ON "presentation_template_assets" USING btree ("rendition_id");--> statement-breakpoint
CREATE INDEX "profiles_profile_photo_idx" ON "profiles" USING btree ("profile_photo_id");--> statement-breakpoint
CREATE INDEX "side_projects_image_idx" ON "side_projects" USING btree ("image_id");--> statement-breakpoint
CREATE INDEX "side_projects_banner_idx" ON "side_projects" USING btree ("banner_id");--> statement-breakpoint
CREATE INDEX "work_experiences_logo_idx" ON "work_experiences" USING btree ("logo_id");--> statement-breakpoint
CREATE INDEX "work_experiences_banner_idx" ON "work_experiences" USING btree ("banner_id");--> statement-breakpoint
ALTER TABLE "presentation_template_assets" ADD CONSTRAINT "presentation_template_assets_one_source" CHECK (num_nonnulls("presentation_template_assets"."file_id", "presentation_template_assets"."rendition_id") = 1);