import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";

const activeStatuses = ["preparing", "sent", "interviewing", "negotiating"];
const finishedStatuses = ["accepted", "withdrawn", "rejected"];
const waitingActions = ["Awaiting response", "Awaiting result"];

export const load: PageServerLoad = async ({ parent, url }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const group = url.searchParams.get("group") || "all";
  const phase = url.searchParams.get("phase") || "";
  const platform = url.searchParams.get("platform") || "";
  const search = url.searchParams.get("q") || "";

  const where: Record<string, unknown> = {
    profile_id: layoutData.selectedProfile.id,
  };

  if (group === "active") {
    where.status = { in: activeStatuses };
  } else if (group === "action") {
    where.status = { in: activeStatuses };
    where.status_action = { notIn: [...waitingActions, ""] };
    where.NOT = { status_action: null };
  } else if (group === "finished") {
    where.status = { in: finishedStatuses };
  }

  if (phase) {
    where.status = phase;
  }

  if (platform) {
    where.jobs = { job_platform_id: parseInt(platform) };
  }

  if (search) {
    const searchConditions = [
      { jobs: { title: { contains: search, mode: "insensitive" } } },
      { jobs: { company: { contains: search, mode: "insensitive" } } },
      { application_note: { contains: search, mode: "insensitive" } },
    ];
    if (platform) {
      // Combine platform filter with search via AND
      const andConditions: Record<string, unknown>[] = [
        { jobs: where.jobs },
        { OR: searchConditions },
      ];
      delete where.jobs;
      where.AND = andConditions;
    } else {
      where.OR = searchConditions;
    }
  }

  const applications = await db.applications.findMany({
    where,
    include: {
      jobs: {
        include: {
          job_platforms: true,
        },
      },
      application_letters: {
        where: { status: "published" },
        take: 1,
      },
    },
    orderBy: { date_created: "desc" },
  });

  // Get platforms that have applications for this profile (for the filter)
  const platforms = await db.job_platforms.findMany({
    where: {
      jobs: {
        some: {
          applications: {
            some: { profile_id: layoutData.selectedProfile.id },
          },
        },
      },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return {
    applications,
    platforms,
    currentGroup: group,
    currentPhase: phase,
    currentPlatform: platform,
    currentSearch: search,
    profileId: layoutData.selectedProfile.id,
  };
};

export const actions: Actions = {
  createApplication: async ({ locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const now = new Date();
    const application = await db.applications.create({
      data: {
        profile_id: profileId,
        status: "preparing",
        status_action: "Send application",
        date_created: now,
        date_updated: now,
        application_seen_date: now,
      },
    });

    await db.application_status_log.create({
      data: {
        application: application.id,
        date_created: now,
        from_status: null,
        to_status: "preparing",
        description: "Application created",
      },
    });

    redirect(302, `/dashboard/applications/${application.id}`);
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

    const existing = await db.applications.findFirst({
      where: { id, profile_id: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Application not found" });
    }

    const now = new Date();
    await db.applications.update({
      where: { id },
      data: {
        status,
        date_updated: now,
      },
    });

    await db.application_status_log.create({
      data: {
        application: id,
        date_created: now,
        from_status: existing.status,
        to_status: status,
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
      return fail(400, { error: "Invalid application ID" });
    }

    const existing = await db.applications.findFirst({
      where: { id, profile_id: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Application not found" });
    }

    await db.applications.delete({
      where: { id },
    });

    return { success: true };
  },
};
