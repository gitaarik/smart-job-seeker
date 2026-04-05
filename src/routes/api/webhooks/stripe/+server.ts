/**
 * Stripe webhook handler.
 *
 * Handles subscription lifecycle events and credit purchases.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { getStripe, getStripeWebhookSecret } from "$lib/server/billing/stripe";
import { planFromPriceId, getCreditPacks } from "$lib/server/billing/plans";
import { getCurrentPeriod } from "$lib/server/billing/usage";
import type Stripe from "stripe";

export const POST: RequestHandler = async ({ request }) => {
  const stripe = getStripe();
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) error(500, "Stripe webhook secret not configured");

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) error(400, "Missing stripe-signature header");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] Signature verification failed:", err);
    error(400, "Invalid signature");
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    case "invoice.paid":
      await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;

    default:
      // Ignore unhandled event types
      break;
  }

  return json({ received: true });
};

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode === "subscription") {
    // Subscription created — will be handled by subscription.updated
    return;
  }

  if (session.mode === "payment") {
    // One-time payment — credit purchase
    const userId = session.metadata?.user_id;
    const packType = session.metadata?.pack_type;
    if (!userId || !packType) return;

    const pack = getCreditPacks().find((p) => p.type === packType);
    if (!pack) return;

    const period = getCurrentPeriod();

    await db.credit_purchases.create({
      data: {
        user_id: userId,
        stripe_payment_intent_id: session.payment_intent as string,
        pack_type: packType,
        amount_cents: pack.priceCents,
        period,
      },
    });

    // Add credits to usage counters
    const updateData: Record<string, { increment: number }> = {};
    for (const [key, amount] of Object.entries(pack.credits)) {
      updateData[key] = { increment: amount };
    }

    await db.usage_counters.upsert({
      where: { user_id_period: { user_id: userId, period } },
      create: {
        user_id: userId,
        period,
        ...Object.fromEntries(
          Object.entries(pack.credits).map(([k, v]) => [k, v]),
        ),
      },
      update: updateData,
    });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const customer = await db.billing_customers.findUnique({
    where: { stripe_customer_id: customerId },
  });
  if (!customer) {
    console.error("[stripe webhook] No customer found for", customerId);
    return;
  }

  const item = subscription.items.data[0];
  const priceId = item?.price.id;
  const plan = planFromPriceId(priceId || "");

  // In Stripe basil API, period dates are on the subscription item
  const periodStart = item?.current_period_start ?? Math.floor(Date.now() / 1000);
  const periodEnd = item?.current_period_end ?? Math.floor(Date.now() / 1000);

  await db.subscriptions.upsert({
    where: { stripe_subscription_id: subscription.id },
    create: {
      user_id: customer.user_id,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId || "",
      plan: plan || "free",
      status: subscription.status,
      current_period_start: new Date(periodStart * 1000),
      current_period_end: new Date(periodEnd * 1000),
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    update: {
      stripe_price_id: priceId || "",
      plan: plan || "free",
      status: subscription.status,
      current_period_start: new Date(periodStart * 1000),
      current_period_end: new Date(periodEnd * 1000),
      cancel_at_period_end: subscription.cancel_at_period_end,
      date_updated: new Date(),
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await db.subscriptions.updateMany({
    where: { stripe_subscription_id: subscription.id },
    data: {
      status: "canceled",
      date_updated: new Date(),
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentFailed(invoice: any) {
  // In basil API, subscription ID may be at invoice.parent.subscription_item_details.subscription
  const subId =
    invoice.parent?.subscription_item_details?.subscription ||
    invoice.subscription;
  if (!subId) return;

  await db.subscriptions.updateMany({
    where: { stripe_subscription_id: subId },
    data: {
      status: "past_due",
      date_updated: new Date(),
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentSucceeded(invoice: any) {
  const subId =
    invoice.parent?.subscription_item_details?.subscription ||
    invoice.subscription;
  if (!subId) return;

  await db.subscriptions.updateMany({
    where: { stripe_subscription_id: subId },
    data: {
      status: "active",
      date_updated: new Date(),
    },
  });
}
