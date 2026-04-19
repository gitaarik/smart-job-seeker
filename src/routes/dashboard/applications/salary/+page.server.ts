import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";
import { type SQL } from "drizzle-orm";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const profile = await db.query.profiles.findFirst({
    where: { id: layoutData.selectedProfile.id },
    select: {
      id: true,
      salary_base_rate: true,
      salary_currency: true,
      salary_adjustments: true,
      salary_region_overrides: true,
    },
  });

  return {
    salarySettings: {
      baseRate: profile?.salary_base_rate ?? null,
      currency: profile?.salary_currency ?? "EUR",
      adjustments: (profile?.salary_adjustments as Record<string, Record<string, number>> | null) ?? {},
      regionOverrides: (profile?.salary_region_overrides as Record<string, { rate: number; currency: string }> | null) ?? {},
    },
    profileId: layoutData.selectedProfile.id,
  };
};

export const actions: Actions = {
  saveRegionRates: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const baseRate = formData.get("base_rate") as string;
    const currency = formData.get("currency") as string;
    const regionOverridesJson = formData.get("region_overrides") as string;

    if (!baseRate || isNaN(parseInt(baseRate)) || parseInt(baseRate) < 0) {
      return fail(400, { error: "A valid base hourly rate is required" });
    }

    let regionOverrides: Record<string, { rate: number; currency: string }> = {};
    try {
      if (regionOverridesJson) {
        regionOverrides = JSON.parse(regionOverridesJson);
      }
    } catch {
      return fail(400, { error: "Invalid region overrides format" });
    }

    await db.profiles.update({
      where: { id: profileId },
      data: {
        salary_base_rate: parseInt(baseRate),
        salary_currency: currency || "EUR",
        salary_region_overrides: regionOverrides as unknown as unknown,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },

  saveAdjustments: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const adjustmentsJson = formData.get("adjustments") as string;

    let adjustments: Record<string, Record<string, number>> = {};
    try {
      if (adjustmentsJson) {
        adjustments = JSON.parse(adjustmentsJson);
      }
    } catch {
      return fail(400, { error: "Invalid adjustments format" });
    }

    await db.profiles.update({
      where: { id: profileId },
      data: {
        salary_adjustments: adjustments as unknown as unknown,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },
};
