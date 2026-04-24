import type { LayoutServerLoad } from "./$types";
import { requireAuth } from "$lib/server/auth/guards";
import { redirect } from "@sveltejs/kit";
import { getProfilesByUserId } from "$lib/server/profile/user-profiles";
import { getBalance } from "$lib/server/billing/credits";
import { getUnreadCount } from "$lib/server/notifications";

export const load: LayoutServerLoad = async (event) => {
  // Require authentication - redirects to /login?redirect=<current-path>
  const user = requireAuth(event);
  const adminUser = event.locals.adminUser ?? null;

  const profiles = await getProfilesByUserId(user.id);

  // If user has no profiles, redirect to create page
  // But allow certain pages that don't require a profile
  const noProfileAllowed = [
    "/profile/create",
    "/billing",
    "/contacts",
    "/feedback",
    "/settings",
  ];
  if (profiles.length === 0) {
    if (!noProfileAllowed.some((p) => event.url.pathname.startsWith(p))) {
      redirect(302, "/profile/create");
    }
    // Return minimal data for pages that don't require a profile
    return {
      user,
      profiles: [],
      selectedProfile: null,
      adminUser,
      creditBalance: 0,
      unreadNotifications: 0,
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

  // Only set cookie when the value changed — avoids "Cannot use cookies.set()
  // after the response has been generated" errors with SvelteKit streaming
  const currentCookie = event.cookies.get("selected_profile_id");
  if (currentCookie !== String(selectedProfileId)) {
    event.cookies.set("selected_profile_id", String(selectedProfileId), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      httpOnly: true,
      sameSite: "lax",
      secure: event.url.protocol === "https:",
    });
  }

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId)!;

  // Start remaining queries in parallel
  const [creditBalance, unreadNotifications] = await Promise.all([
    getBalance(user.id),
    getUnreadCount(user.id),
  ]);

  return {
    user,
    profiles,
    selectedProfile,
    adminUser,
    creditBalance,
    unreadNotifications,
  };
};
