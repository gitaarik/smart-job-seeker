import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async ({ parent, url }) => {
  await parent();

  // Period filter: default to current month
  const now = new Date();
  const periodParam = url.searchParams.get("period");
  let periodStart: Date;
  let periodEnd: Date;
  let periodLabel: string;

  if (periodParam === "all") {
    periodStart = new Date("2020-01-01");
    periodEnd = new Date("2099-12-31");
    periodLabel = "All time";
  } else if (periodParam && /^\d{4}-\d{2}$/.test(periodParam)) {
    const [y, m] = periodParam.split("-").map(Number);
    periodStart = new Date(y, m - 1, 1);
    periodEnd = new Date(y, m, 1);
    periodLabel = periodStart.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  } else {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    periodLabel = periodStart.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  }

  // Fetch AI cost transactions for the period
  const aiTransactions = await db.credit_transactions.findMany({
    where: {
      operation: { in: ["ai_generation", "resume_parse_ai"] },
      created_at: { gte: periodStart, lt: periodEnd },
    },
    select: {
      user_id: true,
      amount: true,
      operation: true,
      metadata: true,
      created_at: true,
    },
  });

  // Fetch active subscriptions to map users to plans
  const activeSubs = await db.subscriptions.findMany({
    where: { status: { in: ["active", "trialing", "past_due"] } },
    orderBy: { date_created: "desc" },
    select: { user_id: true, plan: true },
  });

  const userPlanMap = new Map<string, string>();
  for (const sub of activeSubs) {
    if (!userPlanMap.has(sub.user_id)) {
      userPlanMap.set(sub.user_id, sub.plan);
    }
  }

  // Aggregate by plan
  type PlanStats = {
    plan: string;
    users: Set<string>;
    totalCredits: number;
    totalCostUsd: number;
    transactions: number;
    missingCost: number; // transactions without providerCostUsd
  };

  const planStatsMap = new Map<string, PlanStats>();

  function getOrCreatePlan(plan: string): PlanStats {
    let stats = planStatsMap.get(plan);
    if (!stats) {
      stats = { plan, users: new Set(), totalCredits: 0, totalCostUsd: 0, transactions: 0, missingCost: 0 };
      planStatsMap.set(plan, stats);
    }
    return stats;
  }

  // Also aggregate by provider/model
  type ProviderStats = {
    key: string;
    provider: string;
    model: string;
    totalCostUsd: number;
    totalTokens: number;
    transactions: number;
  };
  const providerStatsMap = new Map<string, ProviderStats>();

  // Top users by cost
  const userCostMap = new Map<string, { userId: string; costUsd: number; credits: number; transactions: number }>();

  for (const tx of aiTransactions) {
    const plan = userPlanMap.get(tx.user_id) ?? "free";
    const stats = getOrCreatePlan(plan);
    stats.users.add(tx.user_id);
    stats.totalCredits += Math.abs(tx.amount);
    stats.transactions++;

    const meta = tx.metadata as Record<string, unknown> | null;
    const costUsd = meta?.providerCostUsd as number | null;
    if (costUsd != null) {
      stats.totalCostUsd += costUsd;
    } else {
      stats.missingCost++;
    }

    // Provider aggregation
    const provider = meta?.provider as string | undefined;
    const model = meta?.model as string | undefined;
    if (provider && model) {
      const key = `${provider}/${model}`;
      let ps = providerStatsMap.get(key);
      if (!ps) {
        ps = { key, provider, model, totalCostUsd: 0, totalTokens: 0, transactions: 0 };
        providerStatsMap.set(key, ps);
      }
      if (costUsd != null) ps.totalCostUsd += costUsd;
      const tokens = meta?.tokens as { totalTokens?: number } | undefined;
      if (tokens?.totalTokens) ps.totalTokens += tokens.totalTokens;
      ps.transactions++;
    }

    // Per-user aggregation
    let userStats = userCostMap.get(tx.user_id);
    if (!userStats) {
      userStats = { userId: tx.user_id, costUsd: 0, credits: 0, transactions: 0 };
      userCostMap.set(tx.user_id, userStats);
    }
    userStats.credits += Math.abs(tx.amount);
    userStats.transactions++;
    if (costUsd != null) userStats.costUsd += costUsd;
  }

  // Plan revenue (monthly price in USD)
  const planPrices: Record<string, number> = {
    free: 0,
    starter: 9,
    pro: 19,
    power: 39,
  };

  const planStats = Array.from(planStatsMap.values())
    .map((s) => ({
      plan: s.plan,
      userCount: s.users.size,
      totalCredits: s.totalCredits,
      totalCostUsd: Math.round(s.totalCostUsd * 10000) / 10000,
      transactions: s.transactions,
      missingCost: s.missingCost,
      revenueUsd: s.users.size * (planPrices[s.plan] ?? 0),
    }))
    .sort((a, b) => {
      const order = ["free", "starter", "pro", "power"];
      return order.indexOf(a.plan) - order.indexOf(b.plan);
    });

  const providerStats = Array.from(providerStatsMap.values())
    .map((s) => ({
      ...s,
      totalCostUsd: Math.round(s.totalCostUsd * 10000) / 10000,
    }))
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd);

  // Top 10 users by cost
  const topUsers = Array.from(userCostMap.values())
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 10)
    .map((u) => ({
      ...u,
      costUsd: Math.round(u.costUsd * 10000) / 10000,
      plan: userPlanMap.get(u.userId) ?? "free",
    }));

  // Fetch user emails for top users
  const topUserIds = topUsers.map((u) => u.userId);
  const topUserRecords = topUserIds.length > 0
    ? await db.users.findMany({
        where: { id: { in: topUserIds } },
        select: { id: true, email: true, name: true },
      })
    : [];
  const userInfoMap = new Map(topUserRecords.map((u) => [u.id, u]));

  const topUsersWithInfo = topUsers.map((u) => ({
    ...u,
    email: userInfoMap.get(u.userId)?.email ?? "unknown",
    name: userInfoMap.get(u.userId)?.name ?? null,
  }));

  // Total summary
  const totalCostUsd = planStats.reduce((sum, p) => sum + p.totalCostUsd, 0);
  const totalRevenueUsd = planStats.reduce((sum, p) => sum + p.revenueUsd, 0);
  const totalTransactions = planStats.reduce((sum, p) => sum + p.transactions, 0);
  const totalMissingCost = planStats.reduce((sum, p) => sum + p.missingCost, 0);

  // Available months (for period selector)
  const firstTx = await db.credit_transactions.findFirst({
    where: { operation: { in: ["ai_generation", "resume_parse_ai"] } },
    orderBy: { created_at: "asc" },
    select: { created_at: true },
  });

  const availableMonths: { value: string; label: string }[] = [];
  if (firstTx?.created_at) {
    const start = new Date(firstTx.created_at);
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= now) {
      const value = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      const label = cursor.toLocaleDateString("en-US", { year: "numeric", month: "short" });
      availableMonths.push({ value, label });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return {
    periodLabel,
    currentPeriod: periodParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    availableMonths,
    planStats,
    providerStats,
    topUsers: topUsersWithInfo,
    summary: {
      totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
      totalRevenueUsd,
      totalTransactions,
      totalMissingCost,
    },
  };
};
