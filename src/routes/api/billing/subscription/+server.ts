/**
 * Get current subscription and usage info.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getUsageSummary } from "$lib/server/billing/usage";

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user) error(401, "Not authenticated");

  const summary = await getUsageSummary(user.id);
  return json(summary);
};
