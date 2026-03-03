import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";

/**
 * PATCH /api/job-searches/[id]
 *
 * Update job search settings (e.g. max_jobs).
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, "Not authenticated");
  }

  const jobSearchId = parseInt(params.id);
  if (isNaN(jobSearchId)) {
    throw error(400, "Invalid job search ID");
  }

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

  const body = await request.json();

  const data: { max_jobs?: number | null; platform_profile_id?: number | null; search_url?: string | null; browser_country_code?: string | null } = {};

  // Validate search_url
  if ("search_url" in body) {
    const url = body.search_url?.trim() || null;
    if (url && !url.startsWith("http")) {
      throw error(400, "search_url must be a valid URL");
    }
    data.search_url = url;
  }

  // Validate max_jobs: null (use default) or positive integer
  if ("max_jobs" in body) {
    if (body.max_jobs === null) {
      data.max_jobs = null;
    } else {
      const maxJobs = parseInt(body.max_jobs);
      if (isNaN(maxJobs) || maxJobs < 1) {
        throw error(400, "max_jobs must be a positive integer or null");
      }
      data.max_jobs = maxJobs;
    }
  }

  // Create new credential and assign it
  if (body.new_credential && jobSearch.platform) {
    const { username, password } = body.new_credential;
    if (!username) {
      throw error(400, "Username is required for new credentials");
    }
    const newCred = await db.platform_profiles.create({
      data: {
        profile: jobSearch.profile,
        platform: jobSearch.platform,
        username,
        password: password || null,
        status: "active",
        date_created: new Date(),
      },
    });
    data.platform_profile_id = newCred.id;
  }
  // Or select existing credential / clear credential
  else if ("platform_profile_id" in body) {
    if (body.platform_profile_id === null) {
      data.platform_profile_id = null;
    } else {
      const credId = parseInt(body.platform_profile_id);
      if (isNaN(credId)) {
        throw error(400, "platform_profile_id must be an integer or null");
      }
      // Verify the credential belongs to this user and platform
      const cred = await db.platform_profiles.findFirst({
        where: {
          id: credId,
          profile: jobSearch.profile,
          platform: jobSearch.platform ?? undefined,
        },
      });
      if (!cred) {
        throw error(404, "Credential not found");
      }
      data.platform_profile_id = credId;
    }
  }

  // Validate browser_country_code
  if ("browser_country_code" in body) {
    const code = body.browser_country_code?.trim().toUpperCase() || null;
    if (code && !/^[A-Z]{2}$/.test(code)) {
      throw error(400, "browser_country_code must be a 2-letter country code");
    }
    data.browser_country_code = code;
  }

  await db.job_searches.update({
    where: { id: jobSearchId },
    data,
  });

  return json({ ok: true });
};
