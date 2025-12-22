#!/usr/bin/env node

import { dbDirect } from "$lib/db";

async function exportProfileData(profileId: string): Promise<void> {
  try {
    console.log(`Exporting profile data for profile ID: ${profileId}`);

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

    // Single efficient query to fetch all profile data
    const data = await dbDirect.profiles.findUnique({
      where: { id },
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
    const existingCollectedData = await dbDirect.collected_data.findFirst({
      where: { profile: id },
    });

    if (existingCollectedData) {
      await dbDirect.collected_data.update({
        where: { id: existingCollectedData.id },
        data: {
          data: JSON.stringify(data, null, 2),
          date_updated: new Date(),
        },
      });
      console.log(`✅ Profile data updated for profile ID ${id}`);
    } else {
      await dbDirect.collected_data.create({
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

exportProfileData(profileId).catch((error) => {
  console.error("Export failed:", error);
  process.exit(1);
});
