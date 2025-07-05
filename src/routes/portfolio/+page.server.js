import { db } from "$lib/db.js";

export async function load({ locals }) {
  const profiles = await db.profiles.findMany({
    include: {
      languages: { orderBy: { sort: "asc" } },
      highlights: { orderBy: { sort: "asc" } },
      tech_skill_categories: {
        include: {
          tech_skills: { orderBy: { sort: "asc" } },
        },
        orderBy: { sort: "asc" },
      },
      soft_skills: { orderBy: { sort: "asc" } },
      dev_methodologies: { orderBy: { sort: "asc" } },
      work_experiences: {
        include: {
          achievements: { orderBy: { sort: "asc" } },
          technologies: { orderBy: { sort: "asc" } },
        },
        orderBy: { sort: "asc" },
      },
      education: { orderBy: { sort: "asc" } },
      side_projects: {
        include: {
          side_project_achievements: { orderBy: { sort: "asc" } },
          side_project_technologies: {
            orderBy: { sort: "asc" },
            where: { status: { equals: "published" } },
          },
        },
        orderBy: { sort: "asc" },
      },
    },
  });

  if (profiles.length) {
    const profile = profiles[0];

    return {
      profile,
    };
  }
}
