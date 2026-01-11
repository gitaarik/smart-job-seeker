import { error } from "@sveltejs/kit";
import { getProfileByIdentifier } from "$lib/server/profile-default";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const { slug } = params;

  // Get profile by slug with all relations
  const profile = await getProfileByIdentifier(slug);

  if (!profile) {
    throw error(404, {
      message: `Profile not found: ${slug}`,
    });
  }

  // Verify profile has a slug (required for this route structure)
  if (!profile.slug) {
    throw error(500, {
      message: "Profile must have a slug to use this route",
    });
  }

  // Separate highlights by type
  const keySkills = profile.highlights?.filter((h) => h.type === "key_skill") ||
    [];
  const contactFor =
    profile.highlights?.filter((h) => h.type === "contact_for") || [];

  // Calculate years of experience
  const currentYear = new Date().getFullYear();
  const devYearsExperience = profile.dev_start_year
    ? currentYear - profile.dev_start_year
    : null;
  const pyJsYearsExperience = profile.python_js_start_year
    ? currentYear - profile.python_js_start_year
    : null;
  const remoteWorkYearsExperience = profile.remote_start_year
    ? currentYear - profile.remote_start_year
    : null;

  return {
    profile,
    keySkills,
    contactFor,
    devYearsExperience,
    pyJsYearsExperience,
    remoteWorkYearsExperience,
  };
};
