/**
 * Subscription plan definitions and limits.
 *
 * This is the single source of truth for what each plan includes.
 * Stripe product/price IDs are configured via environment variables.
 */

import { getEnv } from "$lib/tools/get-env";

export type PlanId = "free" | "starter" | "pro" | "power";

export interface PlanLimits {
  profiles: number;
  resumeVersions: number; // -1 = unlimited
  creditsPerMonth: number;
  extraCredits: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  priceMonthly: number; // cents
  limits: PlanLimits;
  stripePriceId: string | null; // null for free
  usageExample: string[]; // bullet list of example actions
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    profiles: 2,
    resumeVersions: -1,
    creditsPerMonth: 1000,
    extraCredits: true,
  },
  starter: {
    profiles: 5,
    resumeVersions: -1,
    creditsPerMonth: 5000,
    extraCredits: true,
  },
  pro: {
    profiles: 20,
    resumeVersions: -1,
    creditsPerMonth: 15000,
    extraCredits: true,
  },
  power: {
    profiles: -1,
    resumeVersions: -1,
    creditsPerMonth: 50000,
    extraCredits: true,
  },
};

/**
 * Indicative credit costs for display on the pricing page.
 * Actual costs are dynamic — these are rough averages.
 */
export const CREDIT_COST_EXAMPLES = {
  importLocal: { label: "Import & match 100 jobs (local browser)", avgCredits: 800, note: "scrape + extract + match" },
  importCloud: { label: "Import & match 100 jobs (cloud browser)", avgCredits: 1100, note: "scrape + extract + match" },
  aiLetters: { label: "100 AI-generated cover letters", avgCredits: 100, note: "~5k tokens each" },
  pdfExports: { label: "100 PDF exports", avgCredits: 100, note: "1 credit each" },
  resumeParseJSON: { label: "Resume import (JSON)", avgCredits: 0, note: "free" },
};

function loadStripePriceIds(): Record<string, string> {
  return {
    starter: getEnv("SJS_STRIPE_PRICE_STARTER", "") as string,
    pro: getEnv("SJS_STRIPE_PRICE_PRO", "") as string,
    power: getEnv("SJS_STRIPE_PRICE_POWER", "") as string,
    credits: getEnv("SJS_STRIPE_PRICE_CREDITS", "") as string,
  };
}

export function getPlans(): PlanDefinition[] {
  const prices = loadStripePriceIds();
  return [
    {
      id: "free",
      name: "Free",
      description: "Get started with basic features",
      priceMonthly: 0,
      limits: PLAN_LIMITS.free,
      stripePriceId: null,
      usageExample: [
        "Import & match ~80 jobs",
        "10+ AI-generated cover letters",
      ],
    },
    {
      id: "starter",
      name: "Starter",
      description: "For active job seekers",
      priceMonthly: 900,
      limits: PLAN_LIMITS.starter,
      stripePriceId: prices.starter || null,
      usageExample: [
        "Import & match ~400 jobs",
        "50+ AI-generated cover letters",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      description: "For serious job seekers",
      priceMonthly: 1900,
      limits: PLAN_LIMITS.pro,
      stripePriceId: prices.pro || null,
      usageExample: [
        "Import & match ~1,200 jobs",
        "100+ AI-generated letters & questions",
      ],
    },
    {
      id: "power",
      name: "Power",
      description: "For power users and freelancers",
      priceMonthly: 3900,
      limits: PLAN_LIMITS.power,
      stripePriceId: prices.power || null,
      usageExample: [
        "Import & match ~4,000 jobs",
        "Hundreds of AI generations",
        "Effectively unlimited usage",
      ],
    },
  ];
}

export interface CreditPack {
  name: string;
  description: string;
  priceCents: number;
  credits: number;
  stripePriceId: string;
}

export function getCreditPacks(): CreditPack[] {
  const prices = loadStripePriceIds();
  return [
    {
      name: "100 Credits",
      description: "Top up your balance",
      priceCents: 300,
      credits: 100,
      stripePriceId: prices.credits,
    },
  ];
}

/** Map Stripe price ID back to plan ID */
export function planFromPriceId(priceId: string): PlanId | null {
  const plans = getPlans();
  const match = plans.find((p) => p.stripePriceId === priceId);
  return match?.id ?? null;
}
