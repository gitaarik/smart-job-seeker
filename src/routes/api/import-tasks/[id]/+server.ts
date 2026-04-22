import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { search_tasks, platform_profiles, users } from "$lib/server/db/schema";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { searchTaskUpdateSchema, parseBody } from "$lib/server/validation/api-schemas";
import { hasDeviceAccess } from "$lib/server/device-shares";

/**
 * Calculate next scheduled run at the preferred hour in the user's timezone.
 * For any interval, the next run is the soonest future occurrence of preferredHour
 * in the given timezone (today if still upcoming, otherwise tomorrow).
 */
function calculateNextScheduledRun(
  _intervalHours: number, preferredHour: number, timezone: string,
): Date {
  const now = new Date();

  // Get current date parts in the user's timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  const tzYear = get("year");
  const tzMonth = get("month");
  const tzDay = get("day");
  const tzHour = get("hour");

  // Build "today at preferred hour" in the user's timezone using a temp date trick:
  // Create an ISO-like string and resolve via the timezone offset
  const buildDateInTz = (year: number, month: number, day: number, hour: number): Date => {
    // Use Intl to find the UTC offset for this specific date/time in the timezone
    const probe = new Date(Date.UTC(year, month - 1, day, hour));
    const utcStr = probe.toLocaleString("en-US", { timeZone: "UTC", hour12: false });
    const tzStr = probe.toLocaleString("en-US", { timeZone: timezone, hour12: false });
    const utcDate = new Date(utcStr);
    const tzDate = new Date(tzStr);
    const offsetMs = utcDate.getTime() - tzDate.getTime();
    return new Date(Date.UTC(year, month - 1, day, hour) + offsetMs);
  };

  let nextRun = buildDateInTz(tzYear, tzMonth, tzDay, preferredHour);

  // If preferred hour already passed today, schedule for tomorrow
  if (nextRun.getTime() <= now.getTime()) {
    const tomorrow = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay + 1));
    nextRun = buildDateInTz(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), preferredHour);
  }

  return nextRun;
}

/**
 * PATCH /api/import-tasks/[id]
 *
 * Update job search settings (e.g. max_jobs).
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
  const user = requireAuth(locals);
  const searchTaskId = parseIntParam(params.id, "job search");

  const searchTask = await db.query.search_tasks.findFirst({
    where: eq(search_tasks.id, searchTaskId),
    with: { profile: true },
  });

  if (!searchTask) {
    throw error(404, "Job search not found");
  }

  if (searchTask.profile.user_id !== user.id) {
    throw error(403, "Not authorized");
  }

  const body = parseBody(searchTaskUpdateSchema, await request.json());

  const data: { note?: string | null; max_jobs?: number | null; skip_existing?: boolean; stop_after_duplicates?: number | null; skip_first?: number | null; platform_profile_id?: number | null; search_url?: string | null; search_term?: string | null; browser_provider?: string | null; login_mode?: string; keep_minimized?: boolean; schedule_interval_hours?: number | null; schedule_preferred_hour?: number; next_scheduled_run?: Date | null; tunnel_api_key?: number | null } = {};

  if (body.note !== undefined) data.note = body.note || null;
  if (body.search_url !== undefined) data.search_url = body.search_url || null;
  if (body.search_term !== undefined) data.search_term = body.search_term?.trim() || null;
  if (body.max_jobs !== undefined) data.max_jobs = body.max_jobs;
  if (body.skip_existing !== undefined) data.skip_existing = body.skip_existing;
  if (body.stop_after_duplicates !== undefined) data.stop_after_duplicates = body.stop_after_duplicates;
  if (body.skip_first !== undefined) data.skip_first = body.skip_first;
  if (body.login_mode !== undefined) data.login_mode = body.login_mode;
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
  if (body.schedule_preferred_hour !== undefined) {
    data.schedule_preferred_hour = body.schedule_preferred_hour;
  }

  if (body.schedule_interval_hours !== undefined) {
    data.schedule_interval_hours = body.schedule_interval_hours;
    if (body.schedule_interval_hours === null) {
      data.next_scheduled_run = null;
    } else {
      // Calculate next run based on preferred hour in user's timezone
      const preferredHour = body.schedule_preferred_hour ?? searchTask.schedule_preferred_hour ?? 9;
      const userRecord = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { timezone: true },
      });
      const tz = userRecord?.timezone || "UTC";
      data.next_scheduled_run = calculateNextScheduledRun(
        body.schedule_interval_hours, preferredHour, tz,
      );
    }
  } else if (body.schedule_preferred_hour !== undefined && searchTask.schedule_interval_hours) {
    // Only preferred hour changed, recalculate next run
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { timezone: true },
    });
    const tz = userRecord?.timezone || "UTC";
    data.next_scheduled_run = calculateNextScheduledRun(
      searchTask.schedule_interval_hours, body.schedule_preferred_hour, tz,
    );
  }

  // Create new credential and assign it
  if (body.new_credential && searchTask.platform_id) {
    const [newCred] = await db.insert(platform_profiles).values({
      profile_id: searchTask.profile_id,
      platform_id: searchTask.platform_id,
      username: body.new_credential.username,
      password: body.new_credential.password || null,
      status: "active",
      date_created: new Date(),
    }).returning();
    data.platform_profile_id = newCred.id;
  }
  // Or select existing credential / clear credential
  else if (body.platform_profile_id !== undefined) {
    if (body.platform_profile_id === null) {
      data.platform_profile_id = null;
    } else {
      // Verify the credential belongs to this user and platform
      const cred = await db.query.platform_profiles.findFirst({
        where: (t, { and, eq }) => and(
          eq(t.id, body.platform_profile_id!),
          eq(t.profile_id, searchTask.profile_id),
          ...(searchTask.platform_id ? [eq(t.platform_id, searchTask.platform_id)] : []),
        ),
      });
      if (!cred) {
        throw error(404, "Credential not found");
      }
      data.platform_profile_id = body.platform_profile_id;
    }
  }

  await db.update(search_tasks).set(data)
    .where(eq(search_tasks.id, searchTaskId));

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

  const searchTask = await db.query.search_tasks.findFirst({
    where: eq(search_tasks.id, searchTaskId),
    with: { profile: { columns: { user_id: true } } },
  });

  if (!searchTask) {
    throw error(404, "Job search not found");
  }

  if (searchTask.profile.user_id !== user.id) {
    throw error(403, "Not authorized");
  }

  await db.delete(search_tasks).where(eq(search_tasks.id, searchTaskId));

  return json({ ok: true });
};
