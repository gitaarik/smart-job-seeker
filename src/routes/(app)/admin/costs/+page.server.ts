/**
 * Admin cost dashboard.
 *
 * Reads `ai_chats`, which is the log of every LLM call, and NOT
 * `credit_transactions`, which is the log of every call somebody was CHARGED
 * for. Those two differ by everything the product does on its own initiative:
 * matching, scraping, extraction. In August 2026 the charged half was 1.7M of
 * 427.6M tokens, so this page reported roughly $0.50 against a $64.35 invoice
 * and there was no way to tell from the app that the matcher was the bill.
 *
 * Aggregation happens in SQL. `ai_chats` is ~150k rows on dev and a busy month
 * is 44k of them, so per-row pricing in JS means reading all of it into memory
 * for a page nobody loads twice a day. See `estimateGroupCostUsd` for why
 * summing first is exact rather than approximate.
 */
import type { PageServerLoad } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { inArray, desc, sql } from 'drizzle-orm';
import { subscriptions, users as usersTable } from '$lib/server/db/schema';
import {
	estimateGroupCostUsd,
	LONG_CONTEXT_THRESHOLD_TOKENS
} from '$lib/server/billing/provider-costs';
import { promptTemplates } from '$lib/server/ai-chat/prompt-templates';

/** How much of a stored system prompt to group on. */
const PROMPT_KEY_PREFIX = 120;

/**
 * `left(system_prompt, N)` -> the prompt key that produced it.
 *
 * `createAndGenerateAiChat` stores the template UNinterpolated, so a stored
 * system prompt is byte-identical to the one in code until someone edits the
 * template. Rows written before an edit stop matching and fall back to showing
 * their prefix, which is the honest outcome: they really were a different
 * prompt.
 */
const promptKeyByPrefix = new Map<string, string>(
	Object.entries(promptTemplates).map(([key, t]) => [
		t.system_prompt.slice(0, PROMPT_KEY_PREFIX),
		key
	])
);

interface CostRow {
	input_tokens: number;
	cached_input_tokens: number;
	output_tokens: number;
	calls: number;
	cache_hits: number;
	failed: number;
	long_context: boolean;
	provider: string | null;
	model: string | null;
}

/** Per-group cost, plus the reason there isn't one. */
function priceRow(row: CostRow): number | null {
	if (!row.provider || !row.model) return null;
	return estimateGroupCostUsd(
		row.provider,
		row.model,
		{
			inputTokens: Number(row.input_tokens),
			outputTokens: Number(row.output_tokens),
			cachedInputTokens: Number(row.cached_input_tokens)
		},
		row.long_context
	);
}

export const load: PageServerLoad = async ({ parent, url }) => {
	await parent();

	// Period filter: default to current month
	const now = new Date();
	const periodParam = url.searchParams.get('period');
	let periodStart: Date;
	let periodEnd: Date;
	let periodLabel: string;

	if (periodParam === 'all') {
		periodStart = new Date('2020-01-01');
		periodEnd = new Date('2099-12-31');
		periodLabel = 'All time';
	} else if (periodParam && /^\d{4}-\d{2}$/.test(periodParam)) {
		const [y, m] = periodParam.split('-').map(Number);
		periodStart = new Date(y, m - 1, 1);
		periodEnd = new Date(y, m, 1);
		periodLabel = periodStart.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
	} else {
		periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
		periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
		periodLabel = periodStart.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
	}

	// A row with no token counts is not a measurement gap. Either the local
	// llmCache answered it (generateChatCompletionTracked returns
	// `usage: null` on a hit, and no API call was made) or the call failed.
	// Both cost nothing, and lumping them in with "missing cost data" would make
	// coverage look broken on a page whose whole job is to be trusted.
	const byUserAndModel = await db.execute(sql`
		SELECT
			p.user_id AS user_id,
			c.provider AS provider,
			c.model AS model,
			COALESCE(c.input_tokens, 0) > ${LONG_CONTEXT_THRESHOLD_TOKENS} AS long_context,
			COUNT(*)::int AS calls,
			COUNT(*) FILTER (WHERE c.input_tokens IS NULL AND c.error IS NULL)::int AS cache_hits,
			COUNT(*) FILTER (WHERE c.error IS NOT NULL)::int AS failed,
			COALESCE(SUM(c.input_tokens), 0)::bigint AS input_tokens,
			COALESCE(SUM(c.cached_input_tokens), 0)::bigint AS cached_input_tokens,
			COALESCE(SUM(c.output_tokens), 0)::bigint AS output_tokens,
			COALESCE(SUM(c.credits_charged), 0)::bigint AS credits
		FROM ai_chats c
		LEFT JOIN profiles p ON p.id = c.profile_id
		WHERE c.date_created >= ${periodStart} AND c.date_created < ${periodEnd}
		GROUP BY 1, 2, 3, 4
	`);

	const byPrompt = await db.execute(sql`
		SELECT
			LEFT(c.system_prompt, ${PROMPT_KEY_PREFIX}) AS prompt_head,
			c.provider AS provider,
			c.model AS model,
			COALESCE(c.input_tokens, 0) > ${LONG_CONTEXT_THRESHOLD_TOKENS} AS long_context,
			COUNT(*)::int AS calls,
			COUNT(*) FILTER (WHERE c.input_tokens IS NULL AND c.error IS NULL)::int AS cache_hits,
			COUNT(*) FILTER (WHERE c.error IS NOT NULL)::int AS failed,
			COALESCE(SUM(c.input_tokens), 0)::bigint AS input_tokens,
			COALESCE(SUM(c.cached_input_tokens), 0)::bigint AS cached_input_tokens,
			COALESCE(SUM(c.output_tokens), 0)::bigint AS output_tokens
		FROM ai_chats c
		WHERE c.date_created >= ${periodStart} AND c.date_created < ${periodEnd}
		GROUP BY 1, 2, 3, 4
	`);

	const rows = (byUserAndModel as unknown as { rows?: unknown[] }).rows ?? byUserAndModel;
	const promptRows = (byPrompt as unknown as { rows?: unknown[] }).rows ?? byPrompt;

	// Fetch active subscriptions to map users to plans
	const activeSubs = await db.query.subscriptions.findMany({
		where: inArray(subscriptions.status, ['active', 'trialing', 'past_due']),
		orderBy: desc(subscriptions.date_created),
		columns: { user_id: true, plan: true }
	});

	const userPlanMap = new Map<string, string>();
	for (const sub of activeSubs) {
		// A null user_id is a payment record retained past its account's erasure
		// (see $lib/server/account/delete) — it belongs to nobody in this list.
		if (!sub.user_id) continue;
		if (!userPlanMap.has(sub.user_id)) {
			userPlanMap.set(sub.user_id, sub.plan);
		}
	}

	type PlanStats = {
		plan: string;
		users: Set<string>;
		totalCredits: number;
		totalCostUsd: number;
		transactions: number;
		missingCost: number;
	};
	const planStatsMap = new Map<string, PlanStats>();

	type ProviderStats = {
		key: string;
		provider: string;
		model: string;
		totalCostUsd: number;
		totalTokens: number;
		transactions: number;
	};
	const providerStatsMap = new Map<string, ProviderStats>();

	const userCostMap = new Map<
		string,
		{ userId: string; costUsd: number; credits: number; transactions: number }
	>();

	let cacheHits = 0;
	let failedCalls = 0;

	for (const raw of rows as (CostRow & { user_id: string | null; credits: number })[]) {
		const costUsd = priceRow(raw);
		const calls = Number(raw.calls);
		const tokens = Number(raw.input_tokens) + Number(raw.output_tokens);
		cacheHits += Number(raw.cache_hits);
		failedCalls += Number(raw.failed);

		// A profile with no user is an internal or orphaned one; it still spends
		// money, so it gets a bucket rather than being dropped from the totals.
		const userId = raw.user_id ?? 'no-account';
		const plan = raw.user_id ? (userPlanMap.get(raw.user_id) ?? 'free') : 'no-account';

		let stats = planStatsMap.get(plan);
		if (!stats) {
			stats = {
				plan,
				users: new Set(),
				totalCredits: 0,
				totalCostUsd: 0,
				transactions: 0,
				missingCost: 0
			};
			planStatsMap.set(plan, stats);
		}
		stats.users.add(userId);
		stats.totalCredits += Number(raw.credits);
		stats.transactions += calls;
		if (costUsd != null) stats.totalCostUsd += costUsd;
		// Only a call that actually reached a provider can be missing a price.
		else stats.missingCost += calls - Number(raw.cache_hits) - Number(raw.failed);

		if (raw.provider && raw.model) {
			const key = `${raw.provider}/${raw.model}`;
			let ps = providerStatsMap.get(key);
			if (!ps) {
				ps = {
					key,
					provider: raw.provider,
					model: raw.model,
					totalCostUsd: 0,
					totalTokens: 0,
					transactions: 0
				};
				providerStatsMap.set(key, ps);
			}
			if (costUsd != null) ps.totalCostUsd += costUsd;
			ps.totalTokens += tokens;
			ps.transactions += calls;
		}

		let userStats = userCostMap.get(userId);
		if (!userStats) {
			userStats = { userId, costUsd: 0, credits: 0, transactions: 0 };
			userCostMap.set(userId, userStats);
		}
		userStats.credits += Number(raw.credits);
		userStats.transactions += calls;
		if (costUsd != null) userStats.costUsd += costUsd;
	}

	// Per-feature spend: the view that answers "what is the bill actually FOR".
	const promptStatsMap = new Map<
		string,
		{ label: string; matched: boolean; costUsd: number; tokens: number; calls: number }
	>();
	for (const raw of promptRows as (CostRow & { prompt_head: string })[]) {
		const head = raw.prompt_head ?? '';
		const key = promptKeyByPrefix.get(head);
		const label = key ?? `${head.slice(0, 60).replace(/\s+/g, ' ').trim()}…`;
		let ps = promptStatsMap.get(label);
		if (!ps) {
			ps = { label, matched: key != null, costUsd: 0, tokens: 0, calls: 0 };
			promptStatsMap.set(label, ps);
		}
		const costUsd = priceRow(raw);
		if (costUsd != null) ps.costUsd += costUsd;
		ps.tokens += Number(raw.input_tokens) + Number(raw.output_tokens);
		ps.calls += Number(raw.calls);
	}

	// Plan revenue (monthly price in USD)
	const planPrices: Record<string, number> = {
		explorer: 0,
		seeker: 9,
		hunter: 19,
		contractor: 39
	};

	const planStats = Array.from(planStatsMap.values())
		.map((s) => ({
			plan: s.plan,
			userCount: s.users.size,
			totalCredits: s.totalCredits,
			totalCostUsd: Math.round(s.totalCostUsd * 10000) / 10000,
			transactions: s.transactions,
			missingCost: s.missingCost,
			revenueUsd: s.users.size * (planPrices[s.plan] ?? 0)
		}))
		.sort((a, b) => {
			const order = ['explorer', 'seeker', 'hunter', 'contractor'];
			return order.indexOf(a.plan) - order.indexOf(b.plan);
		});

	const providerStats = Array.from(providerStatsMap.values())
		.map((s) => ({
			...s,
			totalCostUsd: Math.round(s.totalCostUsd * 10000) / 10000
		}))
		.sort((a, b) => b.totalCostUsd - a.totalCostUsd);

	const promptStats = Array.from(promptStatsMap.values())
		.map((s) => ({ ...s, costUsd: Math.round(s.costUsd * 10000) / 10000 }))
		.sort((a, b) => b.costUsd - a.costUsd)
		.slice(0, 20);

	// Top 10 users by cost
	const topUsers = Array.from(userCostMap.values())
		.sort((a, b) => b.costUsd - a.costUsd)
		.slice(0, 10)
		.map((u) => ({
			...u,
			costUsd: Math.round(u.costUsd * 10000) / 10000,
			plan: u.userId === 'no-account' ? 'no-account' : (userPlanMap.get(u.userId) ?? 'free')
		}));

	// Fetch user emails for top users
	const topUserIds = topUsers.map((u) => u.userId).filter((id) => id !== 'no-account');
	const topUserRecords =
		topUserIds.length > 0
			? await db.query.users.findMany({
					where: inArray(usersTable.id, topUserIds),
					columns: { id: true, email: true, name: true }
				})
			: [];
	const userInfoMap = new Map(topUserRecords.map((u) => [u.id, u]));

	const topUsersWithInfo = topUsers.map((u) => ({
		...u,
		email:
			u.userId === 'no-account'
				? 'profiles with no account'
				: (userInfoMap.get(u.userId)?.email ?? 'unknown'),
		name: userInfoMap.get(u.userId)?.name ?? null
	}));

	// Total summary
	const totalCostUsd = planStats.reduce((sum, p) => sum + p.totalCostUsd, 0);
	const totalRevenueUsd = planStats.reduce((sum, p) => sum + p.revenueUsd, 0);
	const totalTransactions = planStats.reduce((sum, p) => sum + p.transactions, 0);
	const totalMissingCost = planStats.reduce((sum, p) => sum + p.missingCost, 0);

	// Available months (for period selector)
	const firstRow = await db.execute(sql`
		SELECT MIN(date_created) AS first FROM ai_chats WHERE date_created IS NOT NULL
	`);
	const firstAt = ((firstRow as unknown as { rows?: { first: string | Date | null }[] }).rows ??
		(firstRow as unknown as { first: string | Date | null }[]))[0]?.first;

	const availableMonths: { value: string; label: string }[] = [];
	if (firstAt) {
		const start = new Date(firstAt);
		const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
		while (cursor <= now) {
			const value = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
			const label = cursor.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
			availableMonths.push({ value, label });
			cursor.setMonth(cursor.getMonth() + 1);
		}
	}

	return {
		periodLabel,
		currentPeriod:
			periodParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
		availableMonths,
		planStats,
		providerStats,
		promptStats,
		topUsers: topUsersWithInfo,
		summary: {
			totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
			totalRevenueUsd,
			totalTransactions,
			totalMissingCost,
			cacheHits,
			failedCalls
		}
	};
};
