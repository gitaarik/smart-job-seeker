import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db, queryRaw } from "$lib/server/db";
import { eq, and, inArray, isNotNull, ne, desc, sql, ilike, or } from "drizzle-orm";
import { applications, application_letters, application_status_log, job_importers, job_platforms, jobs } from "$lib/server/db/schema";
import { getSelectedProfileId } from "../../profile/utils";

/**
 * Best-effort lookup of a job_platforms row whose URL matches the host of the
 * given job URL, mirroring the domain-candidate matching in
 * /api/platforms/detect. Returns null when the URL is empty/invalid or no
 * platform matches — manual jobs are allowed to have no platform.
 */
async function detectPlatformId(sourceUrl: string | null): Promise<number | null> {
  if (!sourceUrl) return null;
  let domain: string;
  try {
    const parsed = new URL(sourceUrl.startsWith("http") ? sourceUrl : `https://${sourceUrl}`);
    domain = parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const labels = domain.split(".");
  const candidates: string[] = [];
  for (let i = 0; i < Math.max(labels.length - 1, 1); i++) {
    candidates.push(labels.slice(i).join("."));
  }
  const platform = await db.query.job_platforms.findFirst({
    where: or(...candidates.map((d) => ilike(job_platforms.url, `%${d}%`))),
    columns: { id: true },
  });
  return platform?.id ?? null;
}

function parseIntOrNull(value: FormDataEntryValue | null): number | null {
  const n = parseInt(String(value ?? "").trim(), 10);
  return Number.isNaN(n) ? null : n;
}

function strOrNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

const activeStatuses = ["applying", "interviewing", "negotiating"];
const finishedStatuses = ["accepted", "withdrawn", "rejected"];
const waitingActions = ["Awaiting response", "Awaiting result"];

export const load: PageServerLoad = async ({ parent, url }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const group = url.searchParams.get("group") || "all";
  const phase = url.searchParams.get("phase") || "";
  const platform = url.searchParams.get("platform") || "";
  const search = url.searchParams.get("q") || "";

  const conditions = [eq(applications.profile_id, layoutData.selectedProfile.id)];

  if (group === "active" || group === "action") {
    conditions.push(inArray(applications.status, activeStatuses));
    if (group === "action") {
      conditions.push(isNotNull(applications.status_action));
      conditions.push(ne(applications.status_action, ""));
      // Exclude waiting actions
      for (const wa of waitingActions) {
        conditions.push(ne(applications.status_action, wa));
      }
    }
  } else if (group === "finished") {
    conditions.push(inArray(applications.status, finishedStatuses));
  }

  if (phase) {
    conditions.push(eq(applications.status, phase));
  }

  // Note: platform and search filters that reference related job fields
  // can't easily be done in Drizzle relational queries, so we filter in-memory
  const allApplications = await db.query.applications.findMany({
    where: and(...conditions),
    with: {
      job: {
        with: {
          job_platform: true,
        },
      },
      application_letters: {
        where: eq(application_letters.status, "published"),
        limit: 1,
      },
    },
    orderBy: desc(applications.date_created),
  });

  // Apply platform and search filters in-memory
  let filteredApplications = allApplications;

  if (platform) {
    const platformId = parseInt(platform);
    filteredApplications = filteredApplications.filter(
      (app) => app.job?.job_platform?.id === platformId
    );
  }

  if (search) {
    const q = search.toLowerCase();
    filteredApplications = filteredApplications.filter((app) =>
      app.job?.title?.toLowerCase().includes(q) ||
      app.job?.company?.toLowerCase().includes(q) ||
      app.application_notes?.some((n) => n.text.toLowerCase().includes(q))
    );
  }

  // Get platforms that have applications for this profile (for the filter)
  const platformIds = new Set(
    allApplications
      .map((app) => app.job?.job_platform?.id)
      .filter((id): id is number => id != null)
  );

  const platforms = platformIds.size > 0
    ? await db.query.job_platforms.findMany({
        where: inArray(job_platforms.id, [...platformIds]),
        columns: { id: true, name: true },
      })
    : [];

  return {
    applications: filteredApplications,
    platforms,
    currentGroup: group,
    currentPhase: phase,
    currentPlatform: platform,
    currentSearch: search,
    profileId: layoutData.selectedProfile.id,
  };
};

export const actions: Actions = {
  createApplication: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const title = strOrNull(formData.get("title"));
    const company = strOrNull(formData.get("company"));
    const officeLocation = strOrNull(formData.get("office_location"));
    const sourceUrl = strOrNull(formData.get("source_url"));
    const jobDescription = strOrNull(formData.get("job_description"));
    const salaryMin = parseIntOrNull(formData.get("salary_min"));
    const salaryMax = parseIntOrNull(formData.get("salary_max"));
    const salaryCurrency = strOrNull(formData.get("salary_currency"));
    const salaryPeriod = strOrNull(formData.get("salary_period"));

    // Any filled job field turns this into a manual job + linked application;
    // an empty form keeps the original one-click blank-application behavior.
    const hasJobDetails = !!(
      title || company || officeLocation || sourceUrl || jobDescription ||
      salaryMin || salaryMax
    );

    const now = new Date();

    let jobId: number | null = null;
    if (hasJobDetails) {
      const platformId = await detectPlatformId(sourceUrl);
      const [job] = await db.insert(jobs).values({
        title,
        company,
        office_location: officeLocation,
        source_url: sourceUrl,
        job_description: jobDescription,
        salary_min: salaryMin,
        salary_max: salaryMax,
        salary_currency: salaryCurrency,
        salary_period: salaryPeriod,
        job_platform_id: platformId,
        created_manually: true,
        status: "hiring",
        date_created: now,
        date_updated: now,
      }).returning({ id: jobs.id });
      jobId = job.id;
      // Mirror the scraper import path so the job shows up in this profile's
      // /jobs list ("imported by me").
      await db.insert(job_importers).values({ job_id: jobId, profile_id: profileId });
    }

    const [application] = await db.insert(applications).values({
      job_id: jobId,
      profile_id: profileId,
      status: "applying",
      status_step: "Preparing",
      status_action: "Send application",
      date_created: now,
      date_updated: now,
      // application_seen_date is a Drizzle date() column (string mode).
      application_seen_date: now.toISOString().split("T")[0],
    }).returning();

    await db.insert(application_status_log).values({
      application: application.id,
      date_created: now,
      from_status: null,
      to_status: "applying",
      step: "Preparing",
      action: "Send application",
    });

    redirect(302, `/applications/${application.id}`);
  },

  updateStatus: async ({ request, locals, cookies }) => {
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
    const status = formData.get("status") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid application ID" });
    }

    const existing = await db.query.applications.findFirst({
      where: and(eq(applications.id, id), eq(applications.profile_id, profileId)),
    });

    if (!existing) {
      return fail(404, { error: "Application not found" });
    }

    const now = new Date();
    await db.update(applications).set({
      status,
      date_updated: now,
    }).where(eq(applications.id, id));

    await db.insert(application_status_log).values({
      application: id,
      date_created: now,
      from_status: existing.status,
      to_status: status,
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
      return fail(400, { error: "Invalid application ID" });
    }

    const existing = await db.query.applications.findFirst({
      where: and(eq(applications.id, id), eq(applications.profile_id, profileId)),
    });

    if (!existing) {
      return fail(404, { error: "Application not found" });
    }

    await db.delete(applications).where(eq(applications.id, id));

    return { success: true };
  },
};
