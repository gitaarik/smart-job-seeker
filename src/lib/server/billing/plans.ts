/**
 * Plan definitions — OSS version (free tier only).
 * The cloud version overlays this file with full plan definitions and Stripe integration.
 */

export type PlanId = "explorer" | "seeker" | "hunter" | "contractor";

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
  stripePriceId: string | null;
  usageExample: string[];
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  explorer: {
    profiles: -1,
    resumeVersions: -1,
    creditsPerMonth: 999999,
    extraCredits: false,
  },
  seeker: {
    profiles: -1,
    resumeVersions: -1,
    creditsPerMonth: 999999,
    extraCredits: false,
  },
  hunter: {
    profiles: -1,
    resumeVersions: -1,
    creditsPerMonth: 999999,
    extraCredits: false,
  },
  contractor: {
    profiles: -1,
    resumeVersions: -1,
    creditsPerMonth: 999999,
    extraCredits: false,
  },
};

export const CREDIT_COST_EXAMPLES = {};

export function getPlans(): PlanDefinition[] {
  return [
    {
      id: "explorer",
      name: "Self-hosted",
      description: "Full access, self-hosted",
      priceMonthly: 0,
      limits: PLAN_LIMITS.explorer,
      stripePriceId: null,
      usageExample: [
        "Unlimited profiles",
        "Unlimited usage",
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
  return [];
}

export function planFromPriceId(_priceId: string): PlanId | null {
  return null;
}
