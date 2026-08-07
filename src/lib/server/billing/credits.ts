/**
 * Credit system stub — OSS version (unlimited, no charging).
 * The cloud version overlays this file with real credit tracking and Stripe billing.
 *
 * All operations are free in the OSS version. The API surface is identical
 * so that feature endpoints don't need any changes.
 */

// ---------------------------------------------------------------------------
// Cost calculations (pure math — kept in OSS for shared use)
// ---------------------------------------------------------------------------

/** Convert LLM token count to credit cost (1 credit per 10k tokens) */
export function tokensToCost(totalTokens: number): number {
	return Math.ceil(totalTokens / 10000);
}

/** Calculate scraping credit cost */
export interface ScrapeCostParams {
	jobCount: number;
	browserTimeSeconds: number;
	isCloudBrowser: boolean;
	usedAutoLogin: boolean;
}

export function calculateScrapeCost(params: ScrapeCostParams): number {
	let cost = 2;
	cost += params.jobCount;
	const timeUnits = Math.ceil(params.browserTimeSeconds / 30);
	cost += timeUnits * (params.isCloudBrowser ? 2 : 1);
	if (params.usedAutoLogin) cost += 3;
	return cost;
}

// ---------------------------------------------------------------------------
// Balance (always unlimited in OSS)
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

/** Get the user's current credit balance — always unlimited in OSS. */
export async function getBalance(_userId: string): Promise<CreditBalance> {
	const now = new Date();
	const periodEnd = new Date(now.getTime() + 30 * 86400000);
	return {
		plan: 'explorer',
		used: 0,
		allowance: 999999,
		extra: 0,
		available: 999999,
		period: now.toISOString().split('T')[0],
		periodEnd
	};
}

// ---------------------------------------------------------------------------
// Credit operations (all no-ops in OSS)
// ---------------------------------------------------------------------------

/** Charge credits — no-op in OSS. */
export async function chargeCredits(
	_userId: string,
	_amount: number,
	_operation: string,
	_description?: string,
	_metadata?: Record<string, unknown>
): Promise<void> {
	// No-op: no credit tracking in OSS
}

/** Add extra credits — no-op in OSS. */
export async function addExtraCredits(
	_userId: string,
	_amount: number,
	_description?: string,
	_metadata?: Record<string, unknown>
): Promise<void> {
	// No-op: no credit tracking in OSS
}

/** Row shape of a credit-transaction record (matches `credit_transactions` schema). */
export interface CreditTransaction {
	id: number;
	user_id: string;
	amount: number;
	balance_after: number | null;
	operation: string;
	description: string | null;
	metadata: unknown;
	created_at: Date;
}

/** Get recent credit transactions — always empty in OSS. */
export async function getRecentTransactions(
	_userId: string,
	_limit = 20
): Promise<CreditTransaction[]> {
	return [];
}
