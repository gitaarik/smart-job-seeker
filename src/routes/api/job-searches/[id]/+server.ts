import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { jobSearchUpdateSchema, parseBody } from "$lib/server/validation/api-schemas";

/**
 * PATCH /api/job-searches/[id]
 *
 * Update job search settings (e.g. max_jobs).
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
  const user = requireAuth(locals);
  const jobSearchId = parseIntParam(params.id, "job search");

  const jobSearch = await db.job_searches.findFirst({
    where: { id: jobSearchId },
    include: { profiles: true },
  });

  if (!jobSearch) {
    throw error(404, "Job search not found");
  }

  if (jobSearch.profiles.user_id !== user.id) {
    throw error(403, "Not authorized");
  }

  const body = parseBody(jobSearchUpdateSchema, await request.json());

  const data: { max_jobs?: number | null; skip_existing?: boolean; platform_profile_id?: number | null; search_url?: string | null; search_term?: string | null; browser_provider?: string | null } = {};

  if (body.search_url !== undefined) data.search_url = body.search_url || null;
  if (body.search_term !== undefined) data.search_term = body.search_term?.trim() || null;
  if (body.max_jobs !== undefined) data.max_jobs = body.max_jobs;
  if (body.skip_existing !== undefined) data.skip_existing = body.skip_existing;
  if (body.browser_provider !== undefined) data.browser_provider = body.browser_provider;

  // Create new credential and assign it
  if (body.new_credential && jobSearch.platform) {
    const newCred = await db.platform_profiles.create({
      data: {
        profile: jobSearch.profile,
        platform: jobSearch.platform,
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
          profile: jobSearch.profile,
          platform: jobSearch.platform ?? undefined,
        },
      });
      if (!cred) {
        throw error(404, "Credential not found");
      }
      data.platform_profile_id = body.platform_profile_id;
    }
  }

  await db.job_searches.update({
    where: { id: jobSearchId },
    data,
  });

  return json({ ok: true });
};
