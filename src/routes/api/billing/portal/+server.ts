/**
 * Create a Stripe Customer Portal session.
 *
 * Redirects the user to Stripe's hosted portal for managing
 * payment methods, viewing invoices, and canceling subscriptions.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getStripe } from "$lib/server/billing/stripe";
import { getOrCreateStripeCustomer } from "$lib/server/billing/subscription";
import { config } from "$lib/server/config";

export const POST: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user) error(401, "Not authenticated");

  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(
    user.id,
    user.email,
    user.name,
  );

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${config.publicSiteUrl}/dashboard/billing`,
  });

  return json({ url: session.url });
};
