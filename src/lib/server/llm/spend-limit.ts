/**
 * A ceiling on what the whole instance spends on models in one UTC day.
 *
 * Credits bound each account (billing/credits.ts): every model call a user
 * starts checks the balance, and the matcher and scheduler skip owners who are
 * out. They do not bound the number of accounts, so a signup loop that gets
 * past the captcha, the email check and approval multiplies the free allowance
 * by however many accounts it makes. Nor do they cover the calls no account
 * pays for. This is the backstop for both (planning/GO-LIVE.md § 3).
 *
 * Every chat-model call goes through `generateChatCompletionTracked` and every
 * Jev call through `systemOne`; both check here before paying and add what the
 * answer cost afterwards, priced by `estimateProviderCostUsd`. Embeddings are
 * not counted: fractions of a cent a day.
 *
 * The tally lives in Redis under one key per UTC day, shared by the app and the
 * worker, in micro-dollars so INCRBY stays integral. Like the response cache it
 * fails open: a Redis that cannot answer reads as nothing spent and drops the
 * write, because a Redis outage must not take every AI feature down with it.
 *
 * `SJS_LLM_DAILY_LIMIT_USD` sets the limit (default 25, 0 turns it off).
 * Measured 2026-11-13: dev's busiest day in 180 was $2.78 and preview's p95
 * $2.27; preview's one $28 day was a demo mint re-scoring the whole corpus, the
 * kind of day this exists to stop. Crossing half the limit logs a warning and
 * crossing all of it an error, each once a day, so GlitchTip says so before
 * and when it trips.
 */

import { config } from '$lib/server/config';
import { estimateProviderCostUsd } from '$lib/server/billing/provider-costs';
import { errorTracker } from '$lib/server/monitoring/error-tracker';
import { failOpen } from '../queue/redis-fail-open.js';

const KEY_PREFIX = 'llm:spend:';

/** A day's key outlives the day by long enough to read yesterday's total. */
const KEY_TTL_SECONDS = 3 * 86400;

const MICRO = 1_000_000;

/**
 * Thrown in place of a model call once today's spend has reached the limit.
 *
 * `generateChatCompletionTracked` rethrows it as the `LLMQuotaExceededError` a
 * provider would send, so every chat caller already treats it right: no
 * retry, no fallback provider (`isFallbackEligible`), and the matcher pauses
 * rather than benching jobs (`isFatalLLMError`, which knows this class too, for
 * the Jev path). Its own class rather than that one because langchain.ts
 * imports this module, and the reverse would be a cycle.
 */
export class DailySpendLimitReached extends Error {
	constructor(
		public readonly spentUsd: number,
		public readonly limitUsd: number
	) {
		super(
			`Daily AI spending limit reached ($${spentUsd.toFixed(2)} of $${limitUsd.toFixed(2)}). ` +
				`AI features resume at 00:00 UTC.`
		);
		this.name = 'DailySpendLimitReached';
	}
}

function dayKey(now: Date = new Date()): string {
	return KEY_PREFIX + now.toISOString().slice(0, 10);
}

function limitUsd(): number {
	return config.llmDailyLimitUsd;
}

/** Today's spend in dollars, or 0 when Redis cannot say. */
export async function spentTodayUsd(): Promise<number> {
	const raw = await failOpen('[LLM spend] get', 'treating today as unspent', (client) =>
		client.get(dayKey())
	);
	const micros = raw === null ? 0 : Number(raw);
	return Number.isFinite(micros) ? micros / MICRO : 0;
}

/** Throws DailySpendLimitReached when today's spend is at the limit. */
export async function assertUnderDailyLimit(): Promise<void> {
	const limit = limitUsd();
	if (!(limit > 0)) return;
	const spent = await spentTodayUsd();
	if (spent >= limit) throw new DailySpendLimitReached(spent, limit);
}

/**
 * Add one answered call to today's tally. Unpriced models add nothing
 * (estimateProviderCostUsd warns about them once). Never throws.
 */
export async function recordSpend(
	provider: string,
	model: string,
	usage: {
		inputTokens: number;
		outputTokens: number;
		cachedInputTokens?: number;
		reasoningTokens?: number;
	}
): Promise<void> {
	const limit = limitUsd();
	if (!(limit > 0)) return;
	const usd = estimateProviderCostUsd(
		provider,
		model,
		usage.inputTokens,
		usage.outputTokens,
		usage.cachedInputTokens ?? 0,
		usage.reasoningTokens ?? 0
	);
	if (usd === null || !(usd > 0)) return;
	const micros = Math.ceil(usd * MICRO);
	const key = dayKey();
	const total = await failOpen(
		'[LLM spend] incrby',
		'dropping this call from the tally',
		(client) =>
			client
				.multi()
				.incrby(key, micros)
				.expire(key, KEY_TTL_SECONDS)
				.exec()
				.then((replies) => Number(replies?.[0]?.[1]))
	);
	if (total === null || !Number.isFinite(total)) return;
	reportCrossing(total - micros, total, limit * MICRO, limit);
}

/** Log once per threshold per day: the call whose cost crossed it is the one that logs. */
function reportCrossing(before: number, after: number, limitMicros: number, limit: number) {
	const spent = after / MICRO;
	const metadata = { spentUsd: Number(spent.toFixed(2)), limitUsd: limit };
	if (before < limitMicros && after >= limitMicros) {
		errorTracker.logError(
			'Daily AI spending limit reached; model calls are refused until 00:00 UTC',
			new Error(`LLM daily spend $${spent.toFixed(2)} reached the $${limit} limit`),
			{ operation: 'llm-spend-limit', metadata }
		);
	} else if (before < limitMicros / 2 && after >= limitMicros / 2) {
		errorTracker.logWarning('Half the daily AI spending limit used', {
			operation: 'llm-spend-limit',
			metadata
		});
	}
}
