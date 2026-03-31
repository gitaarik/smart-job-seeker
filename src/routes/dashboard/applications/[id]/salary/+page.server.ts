import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../../profile/utils";
import { createAndGenerateAiChat } from "$lib/server/ai-chat/utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  const profileId = layoutData.profileId;

  const salaryExpectations = await db.salary_expectations.findMany({
    where: { profile: profileId },
    orderBy: { job_title: "asc" },
  });

  return {
    salaryExpectations,
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

  estimateSalary: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const employment_type = formData.get("employment_type") as string;
    const work_arrangement = formData.get("work_arrangement") as string;
    const company_type = formData.get("company_type") as string;
    const region = formData.get("region") as string;
    const currency = formData.get("currency") as string;

    const experience_level = formData.get("experience_level") as string;

    if (!employment_type || !work_arrangement || !company_type || !region) {
      return fail(400, { error: "All parameters are required for estimation" });
    }

    const experienceLevelLabels: Record<string, string> = {
      junior: "Junior",
      mid: "Mid-level",
      senior: "Senior",
      lead: "Lead",
      principal: "Principal",
    };

    // Fetch existing salary expectations to give the LLM context
    const existing = await db.salary_expectations.findMany({
      where: { profile: profileId },
      orderBy: { sort: "asc" },
    });

    const existingSummary = existing.length > 0
      ? existing.map((e) => {
          const rates = [];
          if (e.hourly_rate) rates.push(`${e.hourly_rate}/hr`);
          if (e.daily_rate) rates.push(`${e.daily_rate}/day`);
          if (e.month_salary) rates.push(`${e.month_salary}/mo`);
          if (e.year_salary) rates.push(`${e.year_salary}/yr`);
          return `- ${e.employment_type}, ${e.work_arrangement}${e.experience_level ? `, ${e.experience_level}` : ""}, ${e.company_type}, ${e.region} (${e.currency}): ${rates.join(", ")}${e.job_title ? ` [${e.job_title}]` : ""}`;
        }).join("\n")
      : "No existing salary expectations configured.";

    const employmentTypeLabels: Record<string, string> = {
      any: "Any",
      full_time: "Full-time",
      part_time: "Part-time",
      contract: "Contract",
      temporary: "Temporary",
      freelance: "Freelance",
      internship: "Internship",
    };
    const workArrangementLabels: Record<string, string> = {
      remote: "Remote",
      hybrid: "Hybrid",
      onsite: "On-site",
    };
    const companyTypeLabels: Record<string, string> = {
      startup: "Startup",
      scaleup: "Scale-up",
      corporate: "Corporate",
      agency: "Agency",
      consultancy: "Consultancy",
    };

    const result = await createAndGenerateAiChat(profileId, "estimate_salary_expectations", {
      existingSalaryExpectations: existingSummary,
      employmentType: employmentTypeLabels[employment_type] || employment_type,
      workArrangement: workArrangementLabels[work_arrangement] || work_arrangement,
      experienceLevel: experienceLevelLabels[experience_level] || experience_level || "Not specified",
      companyType: companyTypeLabels[company_type] || company_type,
      region,
      currency: currency || "EUR",
    });

    if (!result.success || !result.aiChat?.response) {
      return fail(500, { error: result.message || "Failed to estimate salary" });
    }

    try {
      const estimate = JSON.parse(result.aiChat.response);
      return { estimate };
    } catch {
      return fail(500, { error: "Failed to parse salary estimate" });
    }
  },

  createFromEstimate: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const employment_type = formData.get("employment_type") as string;
    const work_arrangement = formData.get("work_arrangement") as string;
    const company_type = formData.get("company_type") as string;
    const region = formData.get("region") as string;
    const currency = formData.get("currency") as string;
    const hourly_rate = formData.get("hourly_rate") as string;
    const daily_rate = formData.get("daily_rate") as string;
    const month_salary = formData.get("month_salary") as string;
    const year_salary = formData.get("year_salary") as string;

    if (!company_type || !employment_type || !work_arrangement || !region) {
      return fail(400, { error: "All parameters are required" });
    }

    const lastItem = await db.salary_expectations.findFirst({
      where: { profile: profileId },
      orderBy: { sort: "desc" },
    });

    await db.salary_expectations.create({
      data: {
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

    return { created: true };
  },
};
