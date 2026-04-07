/**
 * Subscription helpers — get active plan, manage Stripe customers.
 */

import { dbDirect as db } from "$lib/server/db";
import { getStripe } from "./stripe";
import type { PlanId } from "./plans";

/** Map legacy plan IDs (pre-v0.4.9) to current names */
const LEGACY_PLAN_MAP: Record<string, PlanId> = {
  free: "explorer",
  starter: "seeker",
  pro: "hunter",
  power: "agency",
};

function normalizePlanId(plan: string): PlanId {
  return LEGACY_PLAN_MAP[plan] ?? plan as PlanId;
}

export interface ActiveSubscription {
  plan: PlanId;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
}

/**
 * Get the user's active subscription, or Free if none.
 */
export async function getActiveSubscription(
  userId: string,
): Promise<ActiveSubscription> {
  const sub = await db.subscriptions.findFirst({
    where: {
      user_id: userId,
      status: { in: ["active", "trialing", "past_due"] },
    },
    orderBy: { date_created: "desc" },
  });

  if (!sub) {
    return {
      plan: "explorer",
      status: "active",
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: null,
    };
  }

  return {
    plan: normalizePlanId(sub.plan),
    status: sub.status,
    currentPeriodStart: sub.current_period_start,
    currentPeriodEnd: sub.current_period_end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    stripeSubscriptionId: sub.stripe_subscription_id,
  };
}

/**
 * Get or create a Stripe customer for a user.
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string | null,
): Promise<string> {
  const existing = await db.billing_customers.findUnique({
    where: { user_id: userId },
  });

  if (existing) return existing.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: { user_id: userId },
  });

  await db.billing_customers.create({
    data: {
      user_id: userId,
      stripe_customer_id: customer.id,
    },
  });

  return customer.id;
}
