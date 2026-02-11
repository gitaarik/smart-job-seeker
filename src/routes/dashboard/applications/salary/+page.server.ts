import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard/profile");
  }

  const salaryExpectations = await db.salary_expectations.findMany({
    where: { profile: layoutData.selectedProfile.id },
    orderBy: { sort: "asc" },
  });

  return {
    salaryExpectations,
    profileId: layoutData.selectedProfile.id,
  };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const job_title = formData.get("job_title") as string;
    const company_type = formData.get("company_type") as string;
    const employment_type = formData.get("employment_type") as string;
    const work_arrangement = formData.get("work_arrangement") as string;
    const region = formData.get("region") as string;
    const currency = formData.get("currency") as string;
    const hourly_rate = formData.get("hourly_rate") as string;
    const daily_rate = formData.get("daily_rate") as string;
    const month_salary = formData.get("month_salary") as string;
    const year_salary = formData.get("year_salary") as string;

    if (!company_type || !employment_type || !work_arrangement || !region) {
      return fail(400, {
        error: "Company type, employment type, work arrangement, and region are required",
      });
    }

    const lastItem = await db.salary_expectations.findFirst({
      where: { profile: profileId },
      orderBy: { sort: "desc" },
    });

    await db.salary_expectations.create({
      data: {
        job_title: job_title?.trim() || null,
        company_type,
        employment_type,
        work_arrangement,
        region,
        currency: currency || "EUR",
        hourly_rate: hourly_rate ? parseInt(hourly_rate) : null,
        daily_rate: daily_rate ? parseInt(daily_rate) : null,
        month_salary: month_salary ? parseInt(month_salary) : null,
        year_salary: year_salary ? parseInt(year_salary) : null,
        profile: profileId,
        sort: (lastItem?.sort ?? -1) + 1,
        date_created: new Date(),
      },
    });

    return { success: true };
  },

  update: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const job_title = formData.get("job_title") as string;
    const company_type = formData.get("company_type") as string;
    const employment_type = formData.get("employment_type") as string;
    const work_arrangement = formData.get("work_arrangement") as string;
    const region = formData.get("region") as string;
    const currency = formData.get("currency") as string;
    const hourly_rate = formData.get("hourly_rate") as string;
    const daily_rate = formData.get("daily_rate") as string;
    const month_salary = formData.get("month_salary") as string;
    const year_salary = formData.get("year_salary") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid salary expectation ID" });
    }

    if (!company_type || !employment_type || !work_arrangement || !region) {
      return fail(400, {
        error: "Company type, employment type, work arrangement, and region are required",
      });
    }

    const existing = await db.salary_expectations.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Salary expectation not found" });
    }

    await db.salary_expectations.update({
      where: { id },
      data: {
        job_title: job_title?.trim() || null,
        company_type,
        employment_type,
        work_arrangement,
        region,
        currency: currency || "EUR",
        hourly_rate: hourly_rate ? parseInt(hourly_rate) : null,
        daily_rate: daily_rate ? parseInt(daily_rate) : null,
        month_salary: month_salary ? parseInt(month_salary) : null,
        year_salary: year_salary ? parseInt(year_salary) : null,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },

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
    const id = parseInt(formData.get("id") as string);

    if (isNaN(id)) {
      return fail(400, { error: "Invalid salary expectation ID" });
    }

    const existing = await db.salary_expectations.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Salary expectation not found" });
    }

    await db.salary_expectations.delete({
      where: { id },
    });

    return { success: true };
  },
};
