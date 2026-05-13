import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { desc, eq } from "drizzle-orm";
import {
  job_platforms,
  search_form_probe_runs,
} from "$lib/server/db/schema";
import { loadSearchFormProbeFormData } from "$lib/server/job-platforms/search-form-probe-form-data";

export const load: PageServerLoad = async ({ params, locals }) => {
  const platformId = parseInt(params.id, 10);
  if (isNaN(platformId)) error(400, "Invalid platform id");

  const user = locals.user;
  if (!user) error(401, "Not authenticated");

  const platform = await db.query.job_platforms.findFirst({
    where: eq(job_platforms.id, platformId),
    columns: {
      id: true,
      name: true,
      key: true,
      url: true,
      login_page_url: true,
      search_page_url: true,
    },
  });
  if (!platform) error(404, "Platform not found");

  const [{ credentials, devices, profileId }, runs] = await Promise.all([
    loadSearchFormProbeFormData(platformId, user.id),
    db.query.search_form_probe_runs.findMany({
      where: eq(search_form_probe_runs.platform_id, platformId),
      orderBy: desc(search_form_probe_runs.started_at),
      limit: 50,
    }),
  ]);

  return { platform, credentials, devices, profileId, runs };
};
