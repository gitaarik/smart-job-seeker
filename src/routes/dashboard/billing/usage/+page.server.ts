import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { getBalance, getRecentTransactions } from "$lib/server/billing/credits";
import { getCreditPacks, CREDIT_COST_EXAMPLES } from "$lib/server/billing/plans";
import { getActiveSubscription } from "$lib/server/billing/subscription";
import { getStripePublishableKey } from "$lib/server/billing/stripe";

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user) redirect(302, "/auth/login");

  const [creditBalance, transactions, subscription] = await Promise.all([
    getBalance(user.id),
    getRecentTransactions(user.id),
    getActiveSubscription(user.id),
  ]);

  const creditPacks = getCreditPacks();
  const stripePublishableKey = getStripePublishableKey();

  return {
    creditBalance,
    transactions,
    subscription,
    creditPacks,
    creditCostExamples: CREDIT_COST_EXAMPLES,
    stripePublishableKey,
  };
};
