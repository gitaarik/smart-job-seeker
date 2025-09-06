-- Drop all foreign key constraints first
ALTER TABLE "resume_tokens" DROP CONSTRAINT IF EXISTS "resume_tokens_createdBy_fkey";
ALTER TABLE "ai_responses" DROP CONSTRAINT IF EXISTS "ai_responses_userId_fkey";
ALTER TABLE "ai_refinements" DROP CONSTRAINT IF EXISTS "ai_refinements_responseId_fkey";
ALTER TABLE "work_highlight_tags" DROP CONSTRAINT IF EXISTS "work_highlight_tags_highlightId_fkey";

-- Create mapping tables for all models to track old CUID to new UUID mapping
DROP TABLE IF EXISTS user_id_mapping;
CREATE TEMPORARY TABLE user_id_mapping (old_id TEXT, new_id UUID DEFAULT gen_random_uuid());

DROP TABLE IF EXISTS resume_token_id_mapping;
CREATE TEMPORARY TABLE resume_token_id_mapping (old_id TEXT, new_id UUID DEFAULT gen_random_uuid());

DROP TABLE IF EXISTS ai_response_id_mapping;
CREATE TEMPORARY TABLE ai_response_id_mapping (old_id TEXT, new_id UUID DEFAULT gen_random_uuid());

DROP TABLE IF EXISTS ai_refinement_id_mapping;
CREATE TEMPORARY TABLE ai_refinement_id_mapping (old_id TEXT, new_id UUID DEFAULT gen_random_uuid());

DROP TABLE IF EXISTS work_highlight_id_mapping;
CREATE TEMPORARY TABLE work_highlight_id_mapping (old_id TEXT, new_id UUID DEFAULT gen_random_uuid());

DROP TABLE IF EXISTS work_highlight_tag_id_mapping;
CREATE TEMPORARY TABLE work_highlight_tag_id_mapping (old_id TEXT, new_id UUID DEFAULT gen_random_uuid());

DROP TABLE IF EXISTS work_technology_id_mapping;
CREATE TEMPORARY TABLE work_technology_id_mapping (old_id TEXT, new_id UUID DEFAULT gen_random_uuid());

DROP TABLE IF EXISTS work_project_id_mapping;
CREATE TEMPORARY TABLE work_project_id_mapping (old_id TEXT, new_id UUID DEFAULT gen_random_uuid());

-- Insert existing IDs and generate new UUIDs for each table
INSERT INTO user_id_mapping (old_id) SELECT id FROM users;
INSERT INTO resume_token_id_mapping (old_id) SELECT id FROM resume_tokens;
INSERT INTO ai_response_id_mapping (old_id) SELECT id FROM ai_responses;
INSERT INTO ai_refinement_id_mapping (old_id) SELECT id FROM ai_refinements;
INSERT INTO work_highlight_id_mapping (old_id) SELECT id FROM work_highlights;
INSERT INTO work_highlight_tag_id_mapping (old_id) SELECT id FROM work_highlight_tags;
INSERT INTO work_technology_id_mapping (old_id) SELECT id FROM work_technologies;
INSERT INTO work_project_id_mapping (old_id) SELECT id FROM work_projects;

-- Add new UUID columns to all tables
ALTER TABLE "users" ADD COLUMN "new_id" UUID;
ALTER TABLE "resume_tokens" ADD COLUMN "new_id" UUID;
ALTER TABLE "ai_responses" ADD COLUMN "new_id" UUID;
ALTER TABLE "ai_refinements" ADD COLUMN "new_id" UUID;
ALTER TABLE "work_highlights" ADD COLUMN "new_id" UUID;
ALTER TABLE "work_highlight_tags" ADD COLUMN "new_id" UUID;
ALTER TABLE "work_technologies" ADD COLUMN "new_id" UUID;
ALTER TABLE "work_projects" ADD COLUMN "new_id" UUID;

-- Update primary key columns with new UUIDs
UPDATE users SET new_id = (SELECT new_id FROM user_id_mapping WHERE old_id = users.id);
UPDATE resume_tokens SET new_id = (SELECT new_id FROM resume_token_id_mapping WHERE old_id = resume_tokens.id);
UPDATE ai_responses SET new_id = (SELECT new_id FROM ai_response_id_mapping WHERE old_id = ai_responses.id);
UPDATE ai_refinements SET new_id = (SELECT new_id FROM ai_refinement_id_mapping WHERE old_id = ai_refinements.id);
UPDATE work_highlights SET new_id = (SELECT new_id FROM work_highlight_id_mapping WHERE old_id = work_highlights.id);
UPDATE work_highlight_tags SET new_id = (SELECT new_id FROM work_highlight_tag_id_mapping WHERE old_id = work_highlight_tags.id);
UPDATE work_technologies SET new_id = (SELECT new_id FROM work_technology_id_mapping WHERE old_id = work_technologies.id);
UPDATE work_projects SET new_id = (SELECT new_id FROM work_project_id_mapping WHERE old_id = work_projects.id);

-- Update foreign key references
UPDATE resume_tokens SET "createdBy" = (SELECT new_id::TEXT FROM user_id_mapping WHERE old_id = resume_tokens."createdBy");
UPDATE ai_responses SET "userId" = (SELECT new_id::TEXT FROM user_id_mapping WHERE old_id = ai_responses."userId");
UPDATE ai_refinements SET "responseId" = (SELECT new_id::TEXT FROM ai_response_id_mapping WHERE old_id = ai_refinements."responseId");
UPDATE work_highlight_tags SET "highlightId" = (SELECT new_id::TEXT FROM work_highlight_id_mapping WHERE old_id = work_highlight_tags."highlightId");

-- Drop old primary key constraints and columns for each table
ALTER TABLE "users" DROP CONSTRAINT "users_pkey";
ALTER TABLE "users" DROP COLUMN "id";
ALTER TABLE "users" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "users" ADD PRIMARY KEY ("id");
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "resume_tokens" DROP CONSTRAINT "resume_tokens_pkey";
ALTER TABLE "resume_tokens" DROP COLUMN "id";
ALTER TABLE "resume_tokens" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "resume_tokens" ADD PRIMARY KEY ("id");
ALTER TABLE "resume_tokens" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "ai_responses" DROP CONSTRAINT "ai_responses_pkey";
ALTER TABLE "ai_responses" DROP COLUMN "id";
ALTER TABLE "ai_responses" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "ai_responses" ADD PRIMARY KEY ("id");
ALTER TABLE "ai_responses" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "ai_refinements" DROP CONSTRAINT "ai_refinements_pkey";
ALTER TABLE "ai_refinements" DROP COLUMN "id";
ALTER TABLE "ai_refinements" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "ai_refinements" ADD PRIMARY KEY ("id");
ALTER TABLE "ai_refinements" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "work_highlights" DROP CONSTRAINT "work_highlights_pkey";
ALTER TABLE "work_highlights" DROP COLUMN "id";
ALTER TABLE "work_highlights" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "work_highlights" ADD PRIMARY KEY ("id");
ALTER TABLE "work_highlights" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "work_highlight_tags" DROP CONSTRAINT "work_highlight_tags_pkey";
ALTER TABLE "work_highlight_tags" DROP COLUMN "id";
ALTER TABLE "work_highlight_tags" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "work_highlight_tags" ADD PRIMARY KEY ("id");
ALTER TABLE "work_highlight_tags" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "work_technologies" DROP CONSTRAINT "work_technologies_pkey";
ALTER TABLE "work_technologies" DROP COLUMN "id";
ALTER TABLE "work_technologies" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "work_technologies" ADD PRIMARY KEY ("id");
ALTER TABLE "work_technologies" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "work_projects" DROP CONSTRAINT "work_projects_pkey";
ALTER TABLE "work_projects" DROP COLUMN "id";
ALTER TABLE "work_projects" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "work_projects" ADD PRIMARY KEY ("id");
ALTER TABLE "work_projects" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Change foreign key column types to UUID
ALTER TABLE "resume_tokens" ALTER COLUMN "createdBy" SET DATA TYPE UUID USING "createdBy"::UUID;
ALTER TABLE "ai_responses" ALTER COLUMN "userId" SET DATA TYPE UUID USING "userId"::UUID;
ALTER TABLE "ai_refinements" ALTER COLUMN "responseId" SET DATA TYPE UUID USING "responseId"::UUID;
ALTER TABLE "work_highlight_tags" ALTER COLUMN "highlightId" SET DATA TYPE UUID USING "highlightId"::UUID;

-- Re-add foreign key constraints
ALTER TABLE "resume_tokens" ADD CONSTRAINT "resume_tokens_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_responses" ADD CONSTRAINT "ai_responses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_refinements" ADD CONSTRAINT "ai_refinements_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "ai_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_highlight_tags" ADD CONSTRAINT "work_highlight_tags_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "work_highlights"("id") ON DELETE CASCADE ON UPDATE CASCADE;