import { prisma } from "$lib/db.js";

export async function load({ locals }) {
  const profiles = await prisma.profiles.findMany({
    include: {
      languages: { orderBy: { sort: "asc" } },
      highlights: { orderBy: { sort: "asc" } },
      tech_skill_categories: {
        include: {
          tech_skills: { orderBy: { sort: "asc" } },
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
