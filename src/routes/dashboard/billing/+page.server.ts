import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { getBalance } from "$lib/server/billing/credits";
import { getCreditPacks, getPlans } from "$lib/server/billing/plans";
import { getActiveSubscription } from "$lib/server/billing/subscription";
import { getStripePublishableKey } from "$lib/server/billing/stripe";

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user) redirect(302, "/auth/login");

  const [subscription, creditBalance] = await Promise.all([
    getActiveSubscription(user.id),
    getBalance(user.id),
  ]);

  const plans = getPlans();
  const creditPacks = getCreditPacks();
  const stripePublishableKey = getStripePublishableKey();

  return {
    subscription,
    plans,
    creditBalance,
    creditPacks,
    stripePublishableKey,
  };
};
