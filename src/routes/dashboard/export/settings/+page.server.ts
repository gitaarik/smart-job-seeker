import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, ne, count, asc } from "drizzle-orm";
import { profiles } from "$lib/server/db/schema";
import { getSelectedProfileId } from "../../profile/utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  // Count user's profiles to prevent deleting the last one
  const [{ profileCount }] = await db.select({ profileCount: count() }).from(profiles).where(eq(profiles.user_id, layoutData.user.id));

  return {
    profileName: layoutData.selectedProfile.name,
    profileId: layoutData.selectedProfile.id,
    isLastProfile: profileCount <= 1,
  };
};

export const actions: Actions = {
  delete: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const confirmName = formData.get("confirmName") as string;

    // Get the profile to verify ownership and name
    const profile = await db.query.profiles.findFirst({
      where: and(eq(profiles.id, profileId), eq(profiles.user_id, user.id)),
    });

    if (!profile) {
      return fail(404, { error: "Profile not found" });
    }

    // Verify confirmation name matches
    if (confirmName !== profile.name) {
      return fail(400, { error: "Profile name does not match" });
    }

    // Check if this is the user's last profile
    const [{ cnt }] = await db.select({ cnt: count() }).from(profiles).where(eq(profiles.user_id, user.id));
    const profileCount = cnt;

    if (profileCount <= 1) {
      return fail(400, { error: "Cannot delete your last profile" });
    }

    // Find the next profile to switch to before deleting
    const nextProfile = await db.query.profiles.findFirst({
      where: and(eq(profiles.user_id, user.id), ne(profiles.id, profileId)),
      columns: { id: true },
      orderBy: asc(profiles.id),
    });

    // Delete the profile (cascades to related records)
    await db.delete(profiles).where(eq(profiles.id, profileId));

    // Clear the selected profile cookie so the layout auto-selects another
    cookies.delete("selected_profile_id", { path: "/dashboard" });

    // Redirect to dashboard overview with the next profile selected
    redirect(303, `/dashboard?profile=${nextProfile!.id}`);
  },
};
