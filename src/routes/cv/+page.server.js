import { prisma } from "$lib/db.js";

export async function load({ locals }) {
  const profiles = await prisma.profiles.findMany({
    include: {
      languages: true,
      highlights: true,
      tech_skills: true,
      tech_skill_categories: true
    },
  });

  if (profiles.length) {
    const profile = profiles[0];

    return {
      profile,
    };
  }
}
