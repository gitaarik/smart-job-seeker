import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { getUsageSummary } from "$lib/server/billing/usage";
import { getPlans, getCreditPacks } from "$lib/server/billing/plans";
import { getStripePublishableKey } from "$lib/server/billing/stripe";

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user) redirect(302, "/auth/login");

  const summary = await getUsageSummary(user.id);
  const plans = getPlans();
  const creditPacks = getCreditPacks();
  const stripePublishableKey = getStripePublishableKey();

  return {
    summary,
    plans,
    creditPacks,
    stripePublishableKey,
  };
};
