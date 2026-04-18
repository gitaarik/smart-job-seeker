/**
 * Subscription stub — OSS version (always free/explorer plan).
 * The cloud version overlays this file with real Stripe subscription management.
 */

import type { PlanId } from "./plans";

export interface ActiveSubscription {
  plan: PlanId;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
}

/**
 * Get the user's active subscription — always returns the free plan in OSS.
 */
export async function getActiveSubscription(
  _userId: string,
): Promise<ActiveSubscription> {
  return {
    plan: "explorer",
    status: "active",
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: null,
  };
}

/**
 * Stripe customer management is not available in the OSS version.
 */
export async function getOrCreateStripeCustomer(
  _userId: string,
  _email: string,
  _name?: string | null,
): Promise<string> {
  throw new Error("Billing is not configured. Stripe is only available in the cloud version.");
}
