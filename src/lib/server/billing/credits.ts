/**
 * Unified credit system.
 *
 * All metered operations consume credits from a single pool.
 * Credit costs:
 *   - AI operations: ceil(totalTokens / 10000) credits  (1 credit per 10k tokens)
 *   - Scraping: base(2) + per-job(1) + browser-time(1/30s, 2x cloud) + auto-login(3)
 *   - PDF export: 1 credit flat
 *   - Resume parse (JSON): free
 *
 * Credit periods:
 *   - Paid users: aligned with Stripe billing cycle (currentPeriodStart → currentPeriodEnd)
 *   - Free users: 30-day rolling windows from signup date
 */

import { error } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getActiveSubscription } from "./subscription";
import { PLAN_LIMITS } from "./plans";

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

/** Format a Date as YYYY-MM-DD for period keys */
function formatPeriodDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

const FREE_PERIOD_DAYS = 30;

/**
 * Compute the current credit period for a user.
 * - Paid: uses Stripe's current_period_start → current_period_end
 * - Free: 30-day windows from signup date
 */
async function getUserPeriod(userId: string): Promise<{
  periodKey: string;
  periodEnd: Date;
}> {
  const sub = await getActiveSubscription(userId);

  // Paid user with a Stripe billing cycle
  if (sub.plan !== "explorer" && sub.currentPeriodStart) {
    return {
      periodKey: formatPeriodDate(sub.currentPeriodStart),
      periodEnd: sub.currentPeriodEnd ?? new Date(sub.currentPeriodStart.getTime() + FREE_PERIOD_DAYS * 86400000),
    };
  }

  // Free user: 30-day windows from signup
  const user = await db.users.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  const signupDate = user?.createdAt ?? new Date();
  const now = new Date();
  const msPerPeriod = FREE_PERIOD_DAYS * 86400000;
  const msSinceSignup = now.getTime() - signupDate.getTime();
  const periodsElapsed = Math.floor(Math.max(0, msSinceSignup) / msPerPeriod);
  const periodStart = new Date(signupDate.getTime() + periodsElapsed * msPerPeriod);
  const periodEnd = new Date(periodStart.getTime() + msPerPeriod);

  return {
    periodKey: formatPeriodDate(periodStart),
    periodEnd,
  };
}

// ---------------------------------------------------------------------------
// Cost calculations
// ---------------------------------------------------------------------------

/** Convert LLM token count to credit cost (1 credit per 10k tokens) */
export function tokensToCost(totalTokens: number): number {
  return Math.ceil(totalTokens / 10000);
}

/** Calculate scraping credit cost (infrastructure only; AI tokens charged separately per-call) */
export interface ScrapeCostParams {
  jobCount: number;
  browserTimeSeconds: number;
  isCloudBrowser: boolean;
  usedAutoLogin: boolean;
}

export function calculateScrapeCost(params: ScrapeCostParams): number {
  let cost = 2; // base cost
  cost += params.jobCount; // 1 credit per job
  const timeUnits = Math.ceil(params.browserTimeSeconds / 30);
  cost += timeUnits * (params.isCloudBrowser ? 2 : 1); // browser time
  if (params.usedAutoLogin) cost += 3;
  return cost;
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

export interface CreditBalance {
  plan: string;
  used: number;
  allowance: number;
  extra: number;
  available: number;
  period: string;
  periodEnd: Date;
}

/** Ensure a credit_balances row exists for the current period */
async function ensureBalance(userId: string): Promise<{ periodKey: string; periodEnd: Date; plan: string }> {
  const { periodKey, periodEnd } = await getUserPeriod(userId);
  const sub = await getActiveSubscription(userId);
  const allowance = PLAN_LIMITS[sub.plan].creditsPerMonth;

  await db.credit_balances.upsert({
    where: { user_id_period: { user_id: userId, period: periodKey } },
    create: {
      user_id: userId,
      period: periodKey,
      credits_used: 0,
      credits_allowance: allowance,
      extra_credits: 0,
    },
    update: {
      // Update allowance in case plan changed mid-period
      credits_allowance: allowance,
    },
  });

  return { periodKey, periodEnd, plan: sub.plan };
}

/** Get the user's current credit balance */
export async function getBalance(userId: string): Promise<CreditBalance> {
  const { periodKey, periodEnd, plan } = await ensureBalance(userId);

  const balance = await db.credit_balances.findUnique({
    where: { user_id_period: { user_id: userId, period: periodKey } },
  });

  const used = balance?.credits_used ?? 0;
  const allowance = balance?.credits_allowance ?? 0;
  const extra = balance?.extra_credits ?? 0;

  return {
    plan,
    used,
    allowance,
    extra,
    available: Math.max(0, allowance + extra - used),
    period: periodKey,
    periodEnd,
  };
}

// ---------------------------------------------------------------------------
// Credit operations
// ---------------------------------------------------------------------------

/**
 * Check if user has enough credits. Throws 403 if not.
 * Call before starting an operation with an estimated cost.
 */
export async function requireCredits(
  userId: string,
  estimatedCost: number,
): Promise<void> {
  const balance = await getBalance(userId);
  if (balance.available < estimatedCost) {
    error(403, {
      message: `Not enough credits (${balance.available} available, ${estimatedCost} needed). Upgrade your plan or buy extra credits.`,
    });
  }
}

/**
 * Charge credits for a completed operation.
 * Records a transaction and updates the balance.
 */
export async function chargeCredits(
  userId: string,
  amount: number,
  operation: string,
  description?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (amount <= 0) return;

  const { periodKey } = await ensureBalance(userId);

  // Atomically increment credits_used
  const updated = await db.credit_balances.update({
    where: { user_id_period: { user_id: userId, period: periodKey } },
    data: { credits_used: { increment: amount } },
  });

  const balanceAfter = Math.max(
    0,
    updated.credits_allowance + updated.extra_credits - updated.credits_used,
  );

  // Record the transaction
  await db.credit_transactions.create({
    data: {
      user_id: userId,
      amount: -amount,
      balance_after: balanceAfter,
      operation,
      description,
      metadata: metadata ? (metadata as any) : undefined,
    },
  });
}

/**
 * Add extra credits (from a credit pack purchase).
 */
export async function addExtraCredits(
  userId: string,
  amount: number,
  description?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (amount <= 0) return;

  const { periodKey } = await ensureBalance(userId);

  const updated = await db.credit_balances.update({
    where: { user_id_period: { user_id: userId, period: periodKey } },
    data: { extra_credits: { increment: amount } },
  });

  const balanceAfter =
    updated.credits_allowance + updated.extra_credits - updated.credits_used;

  await db.credit_transactions.create({
    data: {
      user_id: userId,
      amount,
      balance_after: balanceAfter,
      operation: "credit_purchase",
      description,
      metadata: metadata ? (metadata as any) : undefined,
    },
  });
}

/**
 * Get recent credit transactions for a user.
 */
export async function getRecentTransactions(
  userId: string,
  limit = 20,
) {
  return db.credit_transactions.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    take: limit,
  });
}
