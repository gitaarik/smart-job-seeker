#!/usr/bin/env node

import { dbDirect } from "$lib/server/db";
import { getDefaultProfileId } from "$lib/server/profile/default";
import removeMd from "remove-markdown";

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
      highlights: {
        fields: ["text"],
      },
      tech_skill_categories: {
        fields: ["name"],
        relations: {
          tech_skills: {
            fields: ["name", "years_experience", "level"],
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
          "start_date",
          "end_date",
          "website",
        ],
        relations: {
          work_experience_achievements: {
            fields: [
              "description",
            ],
          },
          work_experience_technologies: {
            fields: ["name"],
          },
          work_experience_projects: {
            fields: [
              "name",
              "url",
              "start_date",
              "end_date",
              "description",
              "outcome",
            ],
            relations: {
              work_experience_project_technologies: {
                fields: ["name"],
              },
            },
          },
        },
      },
      side_projects: {
        fields: [
          "name",
          "start_date",
          "end_date",
          "url",
          "stars",
          "summary",
          "url_label",
        ],
        relations: {
          side_project_achievements: {
            fields: [
              "description",
            ],
          },
          side_project_technologies: {
            fields: ["name"],
          },
        },
      },
      education: {
        fields: [
          "institution",
          "location",
          "url",
          "area",
          "study_type",
          "graduation_year",
          "start_date",
          "end_date",
          "summary",
        ],
      },
      languages: {
        fields: ["name", "language_code", "proficiency"],
      },
      references: {
        fields: ["author", "author_position", "text"],
      },
      project_stories: {
        fields: [
          "title",
          "situation",
          "task",
          "action",
          "result",
          "reflection",
          "category",
        ],
      },
      cheat_sheets: {
        fields: ["title", "content"],
      },
      salary_expectations: {
        fields: [
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

/**
 * Build a schema node recursively for a collection
 * Exported for reusability and testing
 */
export async function buildSchemaNode(
  collection: string,
  fieldNames: string[],
  relations?: Record<string, { fields: string[]; relations?: any }>,
): Promise<SchemaNode> {
  // Fetch collection note
  const collectionMeta = await dbDirect.directus_collections.findUnique({
    where: { collection },
    select: { note: true },
  });

  const node: SchemaNode = {
    note: collectionMeta?.note || undefined,
    fields: {},
  };

  // Fetch field notes
  const fieldMetas = await dbDirect.directus_fields.findMany({
    where: {
      collection,
      field: { in: fieldNames },
    },
    select: { field: true, note: true },
  });

  const fieldNotesMap = Object.fromEntries(
    fieldMetas.map((fm) => [fm.field, removeMd(fm.note || "")]),
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
        relationConfig.relations,
      );
    }
  }

  return node;
}

/**
 * Fetch complete profile data with all relations
 */
async function fetchProfileData(id: number) {
  return await dbDirect.profiles.findUnique({
    where: { id },
    select: {
      name: true,
      title: true,
      phone_number: true,
      email_address: true,
      personal_website: true,
      subtitle: true,
      core_stack: true,
      linkedin_profile: true,
      github_profile: true,
      stackoverflow_profile: true,
      headline: true,
      summary: true,
      nationality: true,
      location_url: true,
      location_timezone: true,
      highlights: {
        select: { text: true },
        orderBy: { sort: "asc" },
      },
      tech_skill_categories: {
        select: {
          name: true,
          tech_skills: {
            select: {
              name: true,
              years_experience: true,
              level: true,
            },
            orderBy: { sort: "desc" },
          },
        },
        orderBy: { sort: "asc" },
      },
      work_experiences: {
        select: {
          name: true,
          location: true,
          description: true,
          position: true,
          summary: true,
          start_date: true,
          end_date: true,
          website: true,
          work_experience_achievements: {
            select: {
              description: true,
            },
            orderBy: { sort: "asc" },
          },
          work_experience_technologies: {
            select: {
              name: true,
            },
            orderBy: { sort: "asc" },
          },
          work_experience_projects: {
            select: {
              name: true,
              url: true,
              start_date: true,
              end_date: true,
              description: true,
              outcome: true,
              work_experience_project_technologies: {
                select: { name: true },
                orderBy: { sort: "asc" },
              },
            },
            orderBy: { sort: "asc" },
          },
        },
        orderBy: { sort: "asc" },
      },
      side_projects: {
        select: {
          name: true,
          start_date: true,
          end_date: true,
          url: true,
          stars: true,
          summary: true,
          url_label: true,
          side_project_achievements: {
            select: {
              description: true,
            },
            orderBy: { sort: "asc" },
          },
          side_project_technologies: {
            select: {
              name: true,
            },
            orderBy: { sort: "asc" },
          },
        },
        orderBy: { sort: "asc" },
      },
      education: {
        select: {
          institution: true,
          location: true,
          url: true,
          area: true,
          study_type: true,
          graduation_year: true,
          start_date: true,
          end_date: true,
          summary: true,
        },
        orderBy: { sort: "asc" },
      },
      languages: {
        select: {
          name: true,
          language_code: true,
          proficiency: true,
        },
        orderBy: { sort: "asc" },
      },
      references: {
        select: {
          author: true,
          author_position: true,
          text: true,
        },
        orderBy: { sort: "asc" },
      },
      project_stories: {
        select: {
          title: true,
          situation: true,
          task: true,
          action: true,
          result: true,
          reflection: true,
          category: true,
        },
        orderBy: { sort: "asc" },
      },
      cheat_sheets: {
        select: {
          title: true,
          content: true,
        },
        orderBy: { sort: "asc" },
      },
      salary_expectations: {
        select: {
          job_title: true,
          company_type: true,
          employment_type: true,
          work_arrangement: true,
          region: true,
          hourly_rate: true,
          month_salary: true,
          year_salary: true,
          daily_rate: true,
        },
        orderBy: { sort: "asc" },
      },
    },
  });
}

/**
 * Export both profile schema and data to collected_data collection
 */
async function exportCollectedData(profileId: string): Promise<void> {
  try {
    console.log(`Exporting collected data for profile ID: ${profileId}`);
    const id = parseInt(profileId, 10);

    // Verify profile exists
    const profile = await dbDirect.profiles.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!profile) {
      console.error(`Profile with ID ${id} not found`);
      return;
    }

    // PARALLEL EXECUTION - Fetch schema and data simultaneously
    console.log("Building schema and fetching data...");
    const profilesConfig = PROFILE_SCHEMA_MAPPING.profiles;
    const [schema, data] = await Promise.all([
      buildSchemaNode(
        "profiles",
        profilesConfig.fields,
        profilesConfig.relations,
      ),
      fetchProfileData(id),
    ]);
    console.log("✓ Schema built");
    console.log("✓ Data fetched");

    // SINGLE DATABASE OPERATION - Update both fields atomically
    const existingCollectedData = await dbDirect.collected_data.findFirst({
      where: { profile: id },
    });

    if (existingCollectedData) {
      await dbDirect.collected_data.update({
        where: { id: existingCollectedData.id },
        data: {
          schema: JSON.stringify(schema, null, 2),
          data: JSON.stringify(data, null, 2),
          date_updated: new Date(),
        },
      });
      console.log(`✅ Collected data updated for profile ID ${id}`);
    } else {
      await dbDirect.collected_data.create({
        data: {
          profile: id,
          schema: JSON.stringify(schema, null, 2),
          data: JSON.stringify(data, null, 2),
          date_updated: new Date(),
        },
      });
      console.log(`✅ Collected data created for profile ID ${id}`);
    }

    console.log(`📁 Schema and data stored in collected_data collection`);
  } catch (error) {
    console.error("Error exporting collected data:", error);
    process.exit(1);
  }
}

// Main execution with default profile support
async function main() {
  let profileId = process.argv[2];

  if (!profileId) {
    const defaultId = await getDefaultProfileId();
    if (!defaultId) {
      console.error(
        "❌ Error: No profile ID provided and no default profile is set",
      );
      console.error(
        "\nUsage: npm run host:export-collected-data [profileId]",
      );
      console.error(
        "\nSet a default profile in Directus or provide a profile ID",
      );
      process.exit(1);
    }
    profileId = defaultId.toString();
    console.log(`Using default profile: ${profileId}`);
  }

  await exportCollectedData(profileId);
}

main().catch((error) => {
  console.error("Export failed:", error);
  process.exit(1);
});
