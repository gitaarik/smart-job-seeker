import { dev } from "$app/environment";
import { prisma } from "$lib/db";
import { redirect } from "@sveltejs/kit";

export async function loadProfile(params) {
  if (!dev) {
    throw redirect(302, "/");
  }

  const profile = await prisma.profiles.findFirst({
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
          work_experience_achievements: { orderBy: { sort: "asc" } },
          work_experience_technologies: { orderBy: { sort: "asc" } },
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
      references: { orderBy: { sort: "asc" } },
      profile_versions: {
        orderBy: { sort: "asc" },
        where: { status: { equals: "published" } }
      },
    },
  });

  console.log(profile)

  return {
    profile,
  };
}
