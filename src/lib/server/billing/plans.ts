/**
 * Subscription plan definitions and limits.
 *
 * This is the single source of truth for what each plan includes.
 * Stripe product/price IDs are configured via environment variables.
 */

import { getEnv } from "$lib/tools/get-env";

export type PlanId = "free" | "starter" | "pro" | "power";

export type UsageFeature =
  | "ai_generations"
  | "ai_followups"
  | "job_matches"
  | "scrape_runs"
  | "pdf_exports"
  | "resume_parses";

export interface PlanLimits {
  profiles: number;
  resumeVersions: number; // -1 = unlimited
  aiGenerations: number;
  aiFollowups: number;
  jobMatches: number;
  scrapeRuns: number;
  pdfExports: number; // -1 = unlimited
  resumeParses: number;
  extraCredits: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  priceMonthly: number; // cents
  limits: PlanLimits;
  stripePriceId: string | null; // null for free
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    profiles: 1,
    resumeVersions: 2,
    aiGenerations: 10,
    aiFollowups: 5,
    jobMatches: 50,
    scrapeRuns: 0,
    pdfExports: 5,
    resumeParses: 1,
    extraCredits: false,
  },
  starter: {
    profiles: 1,
    resumeVersions: 5,
    aiGenerations: 50,
    aiFollowups: 25,
    jobMatches: 200,
    scrapeRuns: 5,
    pdfExports: 20,
    resumeParses: 3,
    extraCredits: true,
  },
  pro: {
    profiles: 3,
    resumeVersions: -1,
    aiGenerations: 200,
    aiFollowups: 100,
    jobMatches: 1000,
    scrapeRuns: 30,
    pdfExports: -1,
    resumeParses: 10,
    extraCredits: true,
  },
  power: {
    profiles: 10,
    resumeVersions: -1,
    aiGenerations: 500,
    aiFollowups: 250,
    jobMatches: 5000,
    scrapeRuns: 100,
    pdfExports: -1,
    resumeParses: 25,
    extraCredits: true,
  },
};

/** Map from feature key to limit key in PlanLimits */
const FEATURE_TO_LIMIT: Record<UsageFeature, keyof PlanLimits> = {
  ai_generations: "aiGenerations",
  ai_followups: "aiFollowups",
  job_matches: "jobMatches",
  scrape_runs: "scrapeRuns",
  pdf_exports: "pdfExports",
  resume_parses: "resumeParses",
};

export function getFeatureLimit(plan: PlanId, feature: UsageFeature): number {
  return PLAN_LIMITS[plan][FEATURE_TO_LIMIT[feature]] as number;
}

export type CreditPackType = "ai" | "matching" | "scraping";

export interface CreditPack {
  type: CreditPackType;
  name: string;
  description: string;
  priceCents: number;
  credits: Record<string, number>;
  stripePriceId: string;
}

function loadStripePriceIds(): Record<string, string> {
  return {
    starter: getEnv("SJS_STRIPE_PRICE_STARTER", "") as string,
    pro: getEnv("SJS_STRIPE_PRICE_PRO", "") as string,
    power: getEnv("SJS_STRIPE_PRICE_POWER", "") as string,
    creditAi: getEnv("SJS_STRIPE_PRICE_CREDIT_AI", "") as string,
    creditMatching: getEnv("SJS_STRIPE_PRICE_CREDIT_MATCHING", "") as string,
    creditScraping: getEnv("SJS_STRIPE_PRICE_CREDIT_SCRAPING", "") as string,
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
    },
    {
      id: "starter",
      name: "Starter",
      description: "For active job seekers",
      priceMonthly: 900,
      limits: PLAN_LIMITS.starter,
      stripePriceId: prices.starter || null,
    },
    {
      id: "pro",
      name: "Pro",
      description: "For serious job seekers",
      priceMonthly: 1900,
      limits: PLAN_LIMITS.pro,
      stripePriceId: prices.pro || null,
    },
    {
      id: "power",
      name: "Power",
      description: "For power users and freelancers",
      priceMonthly: 3900,
      limits: PLAN_LIMITS.power,
      stripePriceId: prices.power || null,
    },
  ];
}

export function getCreditPacks(): CreditPack[] {
  const prices = loadStripePriceIds();
  return [
    {
      type: "ai",
      name: "AI Pack",
      description: "20 AI generations + 10 follow-ups",
      priceCents: 300,
      credits: { extra_ai_generations: 20, extra_ai_followups: 10 },
      stripePriceId: prices.creditAi,
    },
    {
      type: "matching",
      name: "Matching Pack",
      description: "200 job matches",
      priceCents: 200,
      credits: { extra_job_matches: 200 },
      stripePriceId: prices.creditMatching,
    },
    {
      type: "scraping",
      name: "Scraping Pack",
      description: "10 search runs",
      priceCents: 500,
      credits: { extra_scrape_runs: 10 },
      stripePriceId: prices.creditScraping,
    },
  ];
}

/** Map Stripe price ID back to plan ID */
export function planFromPriceId(priceId: string): PlanId | null {
  const plans = getPlans();
  const match = plans.find((p) => p.stripePriceId === priceId);
  return match?.id ?? null;
}
