#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mapping of ExportedProfile structure to Directus collections and fields
const PROFILE_DATA_MAPPING = {
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
              "title",
              "description",
            ],
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
            fields: [
              "title",
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

interface DataNode {
  [key: string]: any;
}

async function buildDataNode(
  collection: string,
  fieldNames: string[],
  relations?: Record<string, { fields: string[]; relations?: any }>,
  profileId?: number
): Promise<DataNode | DataNode[]> {
  // Base query configuration
  const select: Record<string, any> = {};

  // Add requested fields
  for (const fieldName of fieldNames) {
    select[fieldName] = true;
  }

  // Add relations
  if (relations && Object.keys(relations).length > 0) {
    for (const [relationName, relationConfig] of Object.entries(relations)) {
      select[relationName] = {
        select: await buildRelationSelect(relationName, relationConfig),
      };
    }
  }

  // Fetch data based on collection type
  if (collection === "profiles" && profileId) {
    const data = await prisma.profiles.findUnique({
      where: { id: profileId },
      select,
    });
    return data || {};
  } else if (collection === "highlights") {
    const data = await prisma.highlights.findMany({
      where: { profile: profileId },
      select,
    });
    return data;
  } else if (collection === "tech_skill_categories") {
    const data = await prisma.tech_skill_categories.findMany({
      where: { profile: profileId },
      select,
    });
    return data;
  } else if (collection === "tech_skills") {
    const data = await prisma.tech_skills.findMany({
      where: { tech_skill_categories: { some: { profile: profileId } } },
      select,
    });
    return data;
  } else if (collection === "work_experiences") {
    const data = await prisma.work_experiences.findMany({
      where: { profile: profileId },
      select,
    });
    return data;
  } else if (collection === "work_experience_achievements") {
    const data = await prisma.work_experience_achievements.findMany({
      select,
    });
    return data;
  } else if (collection === "work_experience_technologies") {
    const data = await prisma.work_experience_technologies.findMany({
      select,
    });
    return data;
  } else if (collection === "side_projects") {
    const data = await prisma.side_projects.findMany({
      where: { profile: profileId },
      select,
    });
    return data;
  } else if (collection === "side_project_achievements") {
    const data = await prisma.side_project_achievements.findMany({
      select,
    });
    return data;
  } else if (collection === "side_project_technologies") {
    const data = await prisma.side_project_technologies.findMany({
      select,
    });
    return data;
  } else if (collection === "education") {
    const data = await prisma.education.findMany({
      where: { profile: profileId },
      select,
    });
    return data;
  } else if (collection === "languages") {
    const data = await prisma.languages.findMany({
      where: { profile: profileId },
      select,
    });
    return data;
  } else if (collection === "references") {
    const data = await prisma.references.findMany({
      where: { profile: profileId },
      select,
    });
    return data;
  } else if (collection === "project_stories") {
    const data = await prisma.project_stories.findMany({
      where: { profile: profileId },
      select,
    });
    return data;
  } else if (collection === "application_questions") {
    const data = await prisma.application_questions.findMany({
      where: { profile: profileId },
      select,
    });
    return data;
  } else if (collection === "cheat_sheets") {
    const data = await prisma.cheat_sheets.findMany({
      where: { profile: profileId },
      select,
    });
    return data;
  } else if (collection === "salary_expectations") {
    const data = await prisma.salary_expectations.findMany({
      where: { profile: profileId },
      select,
    });
    return data;
  }

  return {};
}

async function buildRelationSelect(
  relationName: string,
  relationConfig: { fields: string[]; relations?: any }
): Promise<Record<string, any>> {
  const select: Record<string, any> = {};

  for (const fieldName of relationConfig.fields) {
    select[fieldName] = true;
  }

  if (relationConfig.relations && Object.keys(relationConfig.relations).length > 0) {
    for (const [nestedRelationName, nestedRelationConfig] of Object.entries(
      relationConfig.relations
    )) {
      select[nestedRelationName] = {
        select: await buildRelationSelect(nestedRelationName, nestedRelationConfig),
      };
    }
  }

  return select;
}

async function exportProfileData(profileId: string): Promise<void> {
  try {
    console.log(`Exporting profile data for profile ID: ${profileId}`);

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

    // Build the data
    const profilesConfig = PROFILE_DATA_MAPPING.profiles;
    const data = await buildDataNode(
      "profiles",
      profilesConfig.fields,
      profilesConfig.relations,
      id
    );

    // Store in collected_data
    const existingCollectedData = await prisma.collected_data.findFirst({
      where: { profile: id },
    });

    if (existingCollectedData) {
      await prisma.collected_data.update({
        where: { id: existingCollectedData.id },
        data: {
          data: JSON.stringify(data, null, 2),
          date_updated: new Date(),
        },
      });
      console.log(`✅ Profile data updated for profile ID ${id}`);
    } else {
      await prisma.collected_data.create({
        data: {
          profile: id,
          data: JSON.stringify(data, null, 2),
          date_updated: new Date(),
        },
      });
      console.log(`✅ Profile data created for profile ID ${id}`);
    }

    console.log(`📁 Data stored in collected_data collection`);
  } catch (error) {
    console.error("Error exporting profile data:", error);
    process.exit(1);
  }
}

// Main execution
const profileId = process.argv[2];
if (!profileId) {
  console.error("Please provide a profile ID as an argument");
  process.exit(1);
}

exportProfileData(profileId)
  .catch((error) => {
    console.error("Export failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
