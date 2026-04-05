/**
 * Create a Stripe Checkout session for subscription or credit purchase.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getStripe } from "$lib/server/billing/stripe";
import { getOrCreateStripeCustomer } from "$lib/server/billing/subscription";
import { getPlans, getCreditPacks } from "$lib/server/billing/plans";
import { config } from "$lib/server/config";

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) error(401, "Not authenticated");

  const body = await request.json();
  const { priceId, type } = body as { priceId?: string; type?: string };

  if (!priceId) error(400, "Price ID required");

  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(
    user.id,
    user.email,
    user.name,
  );

  const baseUrl = config.publicSiteUrl;

  if (type === "credit") {
    // One-time payment for credit pack
    const pack = getCreditPacks().find((p) => p.stripePriceId === priceId);
    if (!pack) error(400, "Invalid credit pack");

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        user_id: user.id,
        pack_type: pack.type,
      },
      success_url: `${baseUrl}/dashboard/billing?success=credits`,
      cancel_url: `${baseUrl}/dashboard/billing`,
    });

    return json({ url: session.url });
  }

  // Subscription checkout
  const plan = getPlans().find((p) => p.stripePriceId === priceId);
  if (!plan) error(400, "Invalid plan");

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      user_id: user.id,
    },
    success_url: `${baseUrl}/dashboard/billing?success=subscription`,
    cancel_url: `${baseUrl}/dashboard/billing`,
  });

  return json({ url: session.url });
};
