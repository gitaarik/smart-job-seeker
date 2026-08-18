ALTER TABLE "project_stories" ADD COLUMN "work_experience_project_id" integer;--> statement-breakpoint
ALTER TABLE "project_stories" ADD COLUMN "side_project_id" integer;--> statement-breakpoint
ALTER TABLE "project_stories" ADD CONSTRAINT "project_stories_work_experience_project_foreign" FOREIGN KEY ("work_experience_project_id") REFERENCES "public"."work_experience_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stories" ADD CONSTRAINT "project_stories_side_project_foreign" FOREIGN KEY ("side_project_id") REFERENCES "public"."side_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_stories_work_experience_project_idx" ON "project_stories" USING btree ("work_experience_project_id");--> statement-breakpoint
CREATE INDEX "project_stories_side_project_idx" ON "project_stories" USING btree ("side_project_id");