import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard/profile");
  }

  // Count user's profiles to prevent deleting the last one
  const profileCount = await db.profiles.count({
    where: { user_id: layoutData.user.id },
  });

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
    const profile = await db.profiles.findFirst({
      where: { id: profileId, user_id: user.id },
    });

    if (!profile) {
      return fail(404, { error: "Profile not found" });
    }

    // Verify confirmation name matches
    if (confirmName !== profile.name) {
      return fail(400, { error: "Profile name does not match" });
    }

    // Check if this is the user's last profile
    const profileCount = await db.profiles.count({
      where: { user_id: user.id },
    });

    if (profileCount <= 1) {
      return fail(400, { error: "Cannot delete your last profile" });
    }

    // Delete the profile (cascades to related records)
    await db.profiles.delete({
      where: { id: profileId },
    });

    // Clear the selected profile cookie
    cookies.delete("selected_profile", { path: "/" });

    // Redirect to dashboard (will auto-select another profile)
    redirect(302, "/dashboard");
  },
};
