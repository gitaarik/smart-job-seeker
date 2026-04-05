/**
 * Stripe client singleton.
 */

import Stripe from "stripe";
import { getEnv } from "$lib/tools/get-env";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = getEnv("SJS_STRIPE_SECRET_KEY");
    if (!key) throw new Error("SJS_STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { apiVersion: "2025-03-31.basil" });
  }
  return _stripe;
}

export function getStripeWebhookSecret(): string {
  return getEnv("SJS_STRIPE_WEBHOOK_SECRET", "") as string;
}

export function getStripePublishableKey(): string {
  return getEnv("SJS_STRIPE_PUBLISHABLE_KEY", "") as string;
}
