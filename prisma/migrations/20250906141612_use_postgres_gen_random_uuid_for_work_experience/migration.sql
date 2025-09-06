-- Drop foreign key constraints first
ALTER TABLE "work_highlights" DROP CONSTRAINT IF EXISTS "work_highlights_workExperienceId_fkey";
ALTER TABLE "work_technologies" DROP CONSTRAINT IF EXISTS "work_technologies_workExperienceId_fkey";  
ALTER TABLE "work_projects" DROP CONSTRAINT IF EXISTS "work_projects_workExperienceId_fkey";

-- Create mapping table to track old ID to new UUID mapping
CREATE TEMPORARY TABLE work_experience_id_mapping (
    old_id TEXT,
    new_id UUID DEFAULT gen_random_uuid()
);

-- Insert existing IDs and generate new UUIDs
INSERT INTO work_experience_id_mapping (old_id)
SELECT id FROM work_experiences;

-- Add new UUID column to work_experiences
ALTER TABLE "work_experiences" ADD COLUMN "new_id" UUID;

-- Update work_experiences with new UUIDs
UPDATE work_experiences 
SET new_id = (SELECT new_id FROM work_experience_id_mapping WHERE old_id = work_experiences.id);

-- Update foreign key references in related tables
UPDATE work_highlights 
SET "workExperienceId" = (SELECT new_id::TEXT FROM work_experience_id_mapping WHERE old_id = work_highlights."workExperienceId");

UPDATE work_technologies 
SET "workExperienceId" = (SELECT new_id::TEXT FROM work_experience_id_mapping WHERE old_id = work_technologies."workExperienceId");

UPDATE work_projects 
SET "workExperienceId" = (SELECT new_id::TEXT FROM work_experience_id_mapping WHERE old_id = work_projects."workExperienceId");

-- Drop old primary key constraint and column
ALTER TABLE "work_experiences" DROP CONSTRAINT "work_experiences_pkey";
ALTER TABLE "work_experiences" DROP COLUMN "id";

-- Rename new_id to id and set as primary key
ALTER TABLE "work_experiences" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "work_experiences" ADD PRIMARY KEY ("id");
ALTER TABLE "work_experiences" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Change foreign key column types to UUID
ALTER TABLE "work_highlights" ALTER COLUMN "workExperienceId" SET DATA TYPE UUID USING "workExperienceId"::UUID;
ALTER TABLE "work_technologies" ALTER COLUMN "workExperienceId" SET DATA TYPE UUID USING "workExperienceId"::UUID;
ALTER TABLE "work_projects" ALTER COLUMN "workExperienceId" SET DATA TYPE UUID USING "workExperienceId"::UUID;

-- Re-add foreign key constraints
ALTER TABLE "work_highlights" ADD CONSTRAINT "work_highlights_workExperienceId_fkey" FOREIGN KEY ("workExperienceId") REFERENCES "work_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_technologies" ADD CONSTRAINT "work_technologies_workExperienceId_fkey" FOREIGN KEY ("workExperienceId") REFERENCES "work_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_projects" ADD CONSTRAINT "work_projects_workExperienceId_fkey" FOREIGN KEY ("workExperienceId") REFERENCES "work_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;