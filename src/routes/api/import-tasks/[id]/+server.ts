import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { searchTaskUpdateSchema, parseBody } from "$lib/server/validation/api-schemas";
import { hasDeviceAccess } from "$lib/server/device-shares";

/**
 * PATCH /api/import-tasks/[id]
 *
 * Update job search settings (e.g. max_jobs).
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
  const user = requireAuth(locals);
  const searchTaskId = parseIntParam(params.id, "job search");

  const searchTask = await db.search_tasks.findFirst({
    where: { id: searchTaskId },
    include: { profiles: true },
  });

  if (!searchTask) {
    throw error(404, "Job search not found");
  }

  if (searchTask.profiles.user_id !== user.id) {
    throw error(403, "Not authorized");
  }

  const body = parseBody(searchTaskUpdateSchema, await request.json());

  const data: { note?: string | null; max_jobs?: number | null; skip_existing?: boolean; stop_after_duplicates?: number | null; skip_first?: number | null; platform_profile_id?: number | null; search_url?: string | null; search_term?: string | null; browser_provider?: string | null; keep_minimized?: boolean; schedule_interval_hours?: number | null; next_scheduled_run?: Date | null; tunnel_api_key?: number | null } = {};

  if (body.note !== undefined) data.note = body.note || null;
  if (body.search_url !== undefined) data.search_url = body.search_url || null;
  if (body.search_term !== undefined) data.search_term = body.search_term?.trim() || null;
  if (body.max_jobs !== undefined) data.max_jobs = body.max_jobs;
  if (body.skip_existing !== undefined) data.skip_existing = body.skip_existing;
  if (body.stop_after_duplicates !== undefined) data.stop_after_duplicates = body.stop_after_duplicates;
  if (body.skip_first !== undefined) data.skip_first = body.skip_first;
  if (body.browser_provider !== undefined) data.browser_provider = body.browser_provider;
  if (body.keep_minimized !== undefined) data.keep_minimized = body.keep_minimized;
  if (body.tunnel_api_key !== undefined) {
    if (body.tunnel_api_key !== null) {
      const canAccess = await hasDeviceAccess(body.tunnel_api_key, user.id);
      if (!canAccess) {
        throw error(403, "You don't have access to this device");
      }
    }
    data.tunnel_api_key = body.tunnel_api_key;
  }
  if (body.schedule_interval_hours !== undefined) {
    data.schedule_interval_hours = body.schedule_interval_hours;
    if (body.schedule_interval_hours === null) {
      data.next_scheduled_run = null;
    } else {
      data.next_scheduled_run = new Date(
        Date.now() + body.schedule_interval_hours * 3600_000,
      );
    }
  }

  // Create new credential and assign it
  if (body.new_credential && searchTask.platform) {
    const newCred = await db.platform_profiles.create({
      data: {
        profile: searchTask.profile,
        platform: searchTask.platform,
        username: body.new_credential.username,
        password: body.new_credential.password || null,
        status: "active",
        date_created: new Date(),
      },
    });
    data.platform_profile_id = newCred.id;
  }
  // Or select existing credential / clear credential
  else if (body.platform_profile_id !== undefined) {
    if (body.platform_profile_id === null) {
      data.platform_profile_id = null;
    } else {
      // Verify the credential belongs to this user and platform
      const cred = await db.platform_profiles.findFirst({
        where: {
          id: body.platform_profile_id,
          profile: searchTask.profile,
          platform: searchTask.platform ?? undefined,
        },
      });
      if (!cred) {
        throw error(404, "Credential not found");
      }
      data.platform_profile_id = body.platform_profile_id;
    }
  }

  await db.search_tasks.update({
    where: { id: searchTaskId },
    data,
  });

  return json({ ok: true });
};

/**
 * DELETE /api/import-tasks/[id]
 *
 * Delete a job search task.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const searchTaskId = parseIntParam(params.id, "job search");

  const searchTask = await db.search_tasks.findFirst({
    where: { id: searchTaskId },
    include: { profiles: { select: { user_id: true } } },
  });

  if (!searchTask) {
    throw error(404, "Job search not found");
  }

  if (searchTask.profiles.user_id !== user.id) {
    throw error(403, "Not authorized");
  }

  await db.search_tasks.delete({
    where: { id: searchTaskId },
  });

  return json({ ok: true });
};
