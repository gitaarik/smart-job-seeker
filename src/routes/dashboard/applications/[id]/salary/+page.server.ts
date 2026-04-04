import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../../profile/utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();
  const profileId = layoutData.profileId;

  const profile = await db.profiles.findUnique({
    where: { id: profileId },
    select: {
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
      regionOverrides: (profile?.salary_region_overrides as Record<string, number> | null) ?? {},
    },
  };
};

export const actions: Actions = {
  updateSalary: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const appId = parseInt(params.id);
    if (isNaN(appId)) return fail(400, { error: "Invalid application ID" });

    const existing = await db.applications.findFirst({
      where: { id: appId, profile: profileId },
    });
    if (!existing) return fail(404, { error: "Application not found" });

    const formData = await request.formData();
    const salary_expectation = formData.get("salary_expectation") as string;
    const salary_currency = formData.get("salary_currency") as string;
    const salary_period = formData.get("salary_period") as string;

    if (!salary_expectation || !salary_currency || !salary_period) {
      return fail(400, { error: "All salary fields are required" });
    }

    const amount = parseFloat(salary_expectation);
    if (isNaN(amount) || amount < 0) {
      return fail(400, { error: "Invalid salary amount" });
    }

    await db.applications.update({
      where: { id: appId },
      data: {
        salary_expectation: amount,
        salary_currency,
        salary_period,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },
};
