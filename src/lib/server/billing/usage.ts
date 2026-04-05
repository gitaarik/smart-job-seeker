/**
 * Usage tracking and limit enforcement.
 */

import { error } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getActiveSubscription } from "./subscription";
import { getFeatureLimit, type PlanId, type UsageFeature } from "./plans";

/** Get current billing period as "YYYY-MM" */
export function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export interface UsageInfo {
  allowed: boolean;
  used: number;
  limit: number; // -1 = unlimited
  extra: number;
  plan: PlanId;
}

/**
 * Check if a user can use a feature.
 */
export async function checkUsage(
  userId: string,
  feature: UsageFeature,
): Promise<UsageInfo> {
  const sub = await getActiveSubscription(userId);
  const limit = getFeatureLimit(sub.plan, feature);

  // -1 = unlimited
  if (limit === -1) {
    return { allowed: true, used: 0, limit: -1, extra: 0, plan: sub.plan };
  }

  const period = getCurrentPeriod();
  const counters = await db.usage_counters.findUnique({
    where: { user_id_period: { user_id: userId, period } },
  });

  const used = (counters?.[feature] as number) ?? 0;
  const extraKey = `extra_${feature}` as keyof typeof counters;
  const extra = counters ? ((counters[extraKey] as number) ?? 0) : 0;

  return {
    allowed: used < limit + extra,
    used,
    limit,
    extra,
    plan: sub.plan,
  };
}

/**
 * Check limit and throw 403 if exceeded. Call before performing the action.
 */
export async function requireUsage(
  userId: string,
  feature: UsageFeature,
): Promise<void> {
  const result = await checkUsage(userId, feature);
  if (!result.allowed) {
    error(403, {
      message: `Monthly ${feature.replace(/_/g, " ")} limit reached (${result.used}/${result.limit}${result.extra ? ` +${result.extra} extra` : ""})`,
    });
  }
}

/**
 * Increment a usage counter. Call after the action succeeds.
 */
export async function incrementUsage(
  userId: string,
  feature: UsageFeature,
): Promise<void> {
  const period = getCurrentPeriod();
  await db.usage_counters.upsert({
    where: { user_id_period: { user_id: userId, period } },
    create: { user_id: userId, period, [feature]: 1 },
    update: { [feature]: { increment: 1 } },
  });
}

/**
 * Get all usage counters for a user for the current period.
 */
export async function getUsageSummary(userId: string) {
  const sub = await getActiveSubscription(userId);
  const period = getCurrentPeriod();
  const counters = await db.usage_counters.findUnique({
    where: { user_id_period: { user_id: userId, period } },
  });

  const features: UsageFeature[] = [
    "ai_generations",
    "ai_followups",
    "job_matches",
    "scrape_runs",
    "pdf_exports",
    "resume_parses",
  ];

  const usage = features.map((feature) => {
    const limit = getFeatureLimit(sub.plan, feature);
    const used = (counters?.[feature] as number) ?? 0;
    const extraKey = `extra_${feature}` as keyof typeof counters;
    const extra = counters ? ((counters[extraKey] as number) ?? 0) : 0;

    return {
      feature,
      used,
      limit,
      extra,
      percentage: limit === -1 ? 0 : Math.round((used / (limit + extra)) * 100),
    };
  });

  return {
    plan: sub.plan,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    period,
    usage,
  };
}
