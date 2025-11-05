#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mapping of ExportedProfile structure to Directus collections and fields
const PROFILE_SCHEMA_MAPPING = {
  profiles: {
    fields: [
      "name",
      "title",
      "location",
      "phone_number",
      "email_address",
      "personal_website",
      "subtitle",
      "core_stack",
      "linkedin_profile",
      "github_profile",
      "stackoverflow_profile",
      "headline",
      "summary",
      "nationality",
      "location_url",
      "location_timezone",
    ],
    relations: {
      profile_versions: {
        fields: ["status", "sort", "name", "description", "toggles"],
      },
      highlights: {
        fields: ["status", "sort", "text", "fa_icon"],
      },
      tech_skill_categories: {
        fields: ["status", "sort", "name", "fa_icon"],
        relations: {
          tech_skills: {
            fields: ["status", "sort", "name", "years_experience", "level"],
          },
        },
      },
      work_experiences: {
        fields: [
          "name",
          "location",
          "description",
          "position",
          "summary",
          "status",
          "sort",
          "start_date",
          "end_date",
          "website",
          "tags",
        ],
        relations: {
          work_experience_achievements: {
            fields: [
              "status",
              "sort",
              "title",
              "description",
              "fa_icon",
              "tags",
            ],
          },
          work_experience_technologies: {
            fields: ["status", "sort", "name"],
          },
        },
      },
      side_projects: {
        fields: [
          "status",
          "sort",
          "name",
          "start_date",
          "end_date",
          "url",
          "stars",
          "summary",
          "url_label",
          "tags",
        ],
        relations: {
          side_project_achievements: {
            fields: [
              "title",
              "fa_icon",
              "description",
              "status",
              "sort",
            ],
          },
          side_project_technologies: {
            fields: ["status", "sort", "name"],
          },
        },
      },
      education: {
        fields: [
          "status",
          "sort",
          "institution",
          "location",
          "url",
          "area",
          "study_type",
          "graduation_year",
          "start_date",
          "end_date",
          "summary",
          "tags",
        ],
      },
      languages: {
        fields: ["status", "sort", "name", "language_code", "proficiency"],
      },
      references: {
        fields: ["status", "sort", "author", "author_position", "text"],
      },
      project_stories: {
        fields: [
          "sort",
          "title",
          "situation",
          "task",
          "action",
          "result",
          "reflection",
          "category",
        ],
      },
      application_questions: {
        fields: ["sort", "question", "answer", "title", "source"],
      },
      cheat_sheets: {
        fields: ["sort", "title", "content"],
      },
      salary_expectations: {
        fields: [
          "sort",
          "job_title",
          "company_type",
          "employment_type",
          "work_arrangement",
          "region",
          "hourly_rate",
          "month_salary",
          "year_salary",
          "daily_rate",
        ],
      },
    },
  },
};

interface SchemaNode {
  note?: string;
  fields?: Record<string, string>;
  relations?: Record<string, SchemaNode>;
}

async function buildSchemaNode(
  collection: string,
  fieldNames: string[],
  relations?: Record<string, { fields: string[]; relations?: any }>
): Promise<SchemaNode> {
  // Fetch collection note
  const collectionMeta = await prisma.directus_collections.findUnique({
    where: { collection },
    select: { note: true },
  });

  const node: SchemaNode = {
    note: collectionMeta?.note || undefined,
    fields: {},
  };

  // Fetch field notes
  const fieldMetas = await prisma.directus_fields.findMany({
    where: {
      collection,
      field: { in: fieldNames },
    },
    select: { field: true, note: true },
  });

  const fieldNotesMap = Object.fromEntries(
    fieldMetas.map((fm) => [fm.field, fm.note])
  );

  for (const fieldName of fieldNames) {
    node.fields![fieldName] = fieldNotesMap[fieldName] || "";
  }

  // Build relations recursively
  if (relations && Object.keys(relations).length > 0) {
    node.relations = {};
    for (const [relationName, relationConfig] of Object.entries(relations)) {
      node.relations[relationName] = await buildSchemaNode(
        relationName,
        relationConfig.fields,
        relationConfig.relations
      );
    }
  }

  return node;
}

async function exportProfileSchema(profileId: string): Promise<void> {
  try {
    console.log(`Exporting profile schema for profile ID: ${profileId}`);

    const id = parseInt(profileId, 10);

    // Verify profile exists
    const profile = await prisma.profiles.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!profile) {
      console.error(`Profile with ID ${id} not found`);
      return;
    }

    // Build the schema
    const profilesConfig = PROFILE_SCHEMA_MAPPING.profiles;
    const schema = await buildSchemaNode(
      "profiles",
      profilesConfig.fields,
      profilesConfig.relations
    );

    // Store in collected_data
    const existingCollectedData = await prisma.collected_data.findFirst({
      where: { profile: id },
    });

    if (existingCollectedData) {
      await prisma.collected_data.update({
        where: { id: existingCollectedData.id },
        data: {
          schema: JSON.stringify(schema, null, 2),
          date_updated: new Date(),
        },
      });
      console.log(`✅ Profile schema updated for profile ID ${id}`);
    } else {
      await prisma.collected_data.create({
        data: {
          profile: id,
          schema: JSON.stringify(schema, null, 2),
          date_updated: new Date(),
        },
      });
      console.log(`✅ Profile schema created for profile ID ${id}`);
    }

    console.log(`📁 Schema stored in collected_data collection`);
  } catch (error) {
    console.error("Error exporting profile schema:", error);
    process.exit(1);
  }
}

// Main execution
const profileId = process.argv[2];
if (!profileId) {
  console.error("Please provide a profile ID as an argument");
  process.exit(1);
}

exportProfileSchema(profileId)
  .catch((error) => {
    console.error("Export failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
