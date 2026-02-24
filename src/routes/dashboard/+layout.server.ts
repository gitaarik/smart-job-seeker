import type { LayoutServerLoad } from "./$types";
import { requireAuth } from "$lib/server/auth/guards";
import { redirect } from "@sveltejs/kit";
import { getProfilesByUserId } from "$lib/server/profile/user-profiles";
import { dbDirect as db } from "$lib/server/db";

export const load: LayoutServerLoad = async (event) => {
  // Require authentication - redirects to /login?redirect=/dashboard
  const user = requireAuth(event);

  // Get all profiles owned by this user
  const profiles = await getProfilesByUserId(user.id);

  // If user has no profiles, redirect to create page
  // But not if we're already on the create page (to avoid infinite redirect)
  if (profiles.length === 0) {
    if (!event.url.pathname.startsWith("/dashboard/profile/create")) {
      redirect(302, "/dashboard/profile/create");
    }
    // Return minimal data for create page
    return {
      user,
      profiles: [],
      selectedProfile: null,
    };
  }

  // Determine selected profile
  let selectedProfileId: number | null = null;

  // 1. Check URL parameter
  const urlProfileId = event.url.searchParams.get("profile");
  if (urlProfileId) {
    const parsed = parseInt(urlProfileId, 10);
    if (!isNaN(parsed) && profiles.some((p) => p.id === parsed)) {
      selectedProfileId = parsed;
    }
  }

  // 2. Check cookie if no URL param
  if (!selectedProfileId) {
    const cookieProfileId = event.cookies.get("selected_profile_id");
    if (cookieProfileId) {
      const parsed = parseInt(cookieProfileId, 10);
      if (!isNaN(parsed) && profiles.some((p) => p.id === parsed)) {
        selectedProfileId = parsed;
      }
    }
  }

  // 3. Default to first profile
  if (!selectedProfileId) {
    selectedProfileId = profiles[0].id;
  }

  // Set cookie for persistence
  event.cookies.set("selected_profile_id", String(selectedProfileId), {
    path: "/dashboard",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: true,
    sameSite: "lax",
  });

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId)!;

  return {
    user,
    profiles,
    selectedProfile,
  };
};
