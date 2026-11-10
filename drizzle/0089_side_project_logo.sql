ALTER TABLE "side_projects" ADD COLUMN "logo_id" uuid;--> statement-breakpoint
ALTER TABLE "side_projects" ADD CONSTRAINT "side_projects_logo_id_media_renditions_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media_renditions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "side_projects_logo_idx" ON "side_projects" USING btree ("logo_id");