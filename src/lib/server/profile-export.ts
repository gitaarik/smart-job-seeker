/**
 * Profile export utilities
 * Handles exporting profile schema and data to collected_data collection
 */

import { db } from "$lib/db";
import removeMd from "remove-markdown";

interface SchemaNode {
  note?: string;
  fields?: Record<string, string>;
  relations?: Record<string, SchemaNode>;
}

/**
 * Mapping of ExportedProfile structure to Directus collections and fields
 */
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
            fields: ["title", "description"],
          },
          work_experience_technologies: {
            fields: ["name"],
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
            fields: ["title", "description"],
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
      application_questions: {
        fields: ["question", "answer", "title", "source"],
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

/**
 * Build a schema node with field notes
 */
async function buildSchemaNode(
  collection: string,
  fieldNames: string[],
  relations?: Record<
    string,
    { fields: string[]; relations?: Record<string, unknown> }
  >,
): Promise<SchemaNode> {
  // Fetch collection note
  const collectionMeta = await db.directus_collections.findUnique({
    where: { collection },
    select: { note: true },
  });

  const node: SchemaNode = {
    note: collectionMeta?.note || undefined,
    fields: {},
  };

  // Fetch field notes
  const fieldMetas = await db.directus_fields.findMany({
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
        relationConfig.relations as Record<string, { fields: string[] }>,
      );
    }
  }

  return node;
}

/**
 * Export profile schema
 * Builds the schema definition for a profile and stores it in collected_data
 */
export async function exportProfileSchema(profileId: number): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Verify profile exists
    const profile = await db.profiles.findUnique({
      where: { id: profileId },
      select: { id: true },
    });

    if (!profile) {
      return {
        success: false,
        message: `Profile with ID ${profileId} not found`,
      };
    }

    // Build the schema
    const profilesConfig = PROFILE_SCHEMA_MAPPING.profiles;
    const schema = await buildSchemaNode(
      "profiles",
      profilesConfig.fields,
      profilesConfig.relations as Record<string, { fields: string[] }>,
    );

    // Store in collected_data
    const existingCollectedData = await db.collected_data.findFirst({
      where: { profile: profileId },
    });

    if (existingCollectedData) {
      await db.collected_data.update({
        where: { id: existingCollectedData.id },
        data: {
          schema: JSON.stringify(schema, null, 2),
          date_updated: new Date(),
        },
      });
    } else {
      await db.collected_data.create({
        data: {
          profile: profileId,
          schema: JSON.stringify(schema, null, 2),
          date_updated: new Date(),
        },
      });
    }

    return {
      success: true,
      message: `Profile schema exported for profile ID ${profileId}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error exporting profile schema: ${errorMessage}`,
    };
  }
}

/**
 * Export profile data
 * Fetches all profile data and stores it in collected_data
 */
export async function exportProfileData(profileId: number): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Verify profile exists
    const profile = await db.profiles.findUnique({
      where: { id: profileId },
      select: { id: true },
    });

    if (!profile) {
      return {
        success: false,
        message: `Profile with ID ${profileId} not found`,
      };
    }

    // Single efficient query to fetch all profile data
    const data = await db.profiles.findUnique({
      where: { id: profileId },
      select: {
        name: true,
        title: true,
        location: true,
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
                title: true,
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
                title: true,
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
        application_questions: {
          select: {
            question: true,
            answer: true,
            title: true,
            source: true,
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

    // Store in collected_data
    const existingCollectedData = await db.collected_data.findFirst({
      where: { profile: profileId },
    });

    if (existingCollectedData) {
      await db.collected_data.update({
        where: { id: existingCollectedData.id },
        data: {
          data: JSON.stringify(data, null, 2),
          date_updated: new Date(),
        },
      });
    } else {
      await db.collected_data.create({
        data: {
          profile: profileId,
          data: JSON.stringify(data, null, 2),
          date_updated: new Date(),
        },
      });
    }

    return {
      success: true,
      message: `Profile data exported for profile ID ${profileId}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      success: false,
      message: `Error exporting profile data: ${errorMessage}`,
    };
  }
}

/**
 * Export both profile schema and data
 * Combines exportProfileSchema and exportProfileData
 */
export async function exportProfile(profileId: number): Promise<{
  success: boolean;
  schemaResult: {
    success: boolean;
    message: string;
  };
  dataResult: {
    success: boolean;
    message: string;
  };
}> {
  const schemaResult = await exportProfileSchema(profileId);
  const dataResult = await exportProfileData(profileId);

  return {
    success: schemaResult.success && dataResult.success,
    schemaResult,
    dataResult,
  };
}
