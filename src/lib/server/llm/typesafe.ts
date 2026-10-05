/**
 * TypeSafe's System One API, which serves Jev: a decision model, not a chat
 * model (https://docs.typesafe.ai/api).
 *
 * It takes a `state` and named questions and answers each one with a value
 * instead of text. Two kinds are used here: the yes/no question ("noul"),
 * answered with the probability of yes, and the score question, answered with
 * a level between its criteria. None of the chat wrapper applies (no messages,
 * no JSON to parse, no response cache), so this is a plain HTTP call.
 */
import { config } from '$lib/server/config';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

export interface NoulQuestion {
	type: 'noul';
	instructions: string;
}

/**
 * A question answered on a scale: `criteria` describes each level, worst first,
 * and the answer's `score` is the probability-weighted level, so 1.4 lies
 * between the second and the third. Two to ten levels.
 */
export interface ScoreQuestion {
	type: 'score';
	instructions: string;
	criteria: readonly string[];
}

export interface SystemOneRequest {
	model: string;
	state: unknown;
	questions: Record<string, NoulQuestion | ScoreQuestion>;
}

export interface SystemOneAnswer {
	type: string;
	/** A noul's probability of yes. */
	noul?: number;
	/** A score question's level, 0 for its first criterion. */
	score?: number;
	/** A score question's probability per level, keyed "0", "1", ... */
	probabilities?: Record<string, number>;
	confidence?: number;
}

export interface SystemOneResponse {
	model: string;
	answers: Record<string, SystemOneAnswer>;
	usage: { input_tokens: number; output_tokens: number };
}

/**
 * A call that failed, with what the API said about it. `errorType` is the API's
 * own name for the error when it gave one.
 */
export class TypeSafeError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly errorType: string | null
	) {
		super(message);
		this.name = 'TypeSafeError';
	}
}

/**
 * The state is over the model's limit: 32k tokens for the state plus the
 * longest question. The API answers it with a 400 naming the error (measured
 * 2026-10-05), not with a 422.
 */
export const isOversize = (error: unknown): boolean =>
	error instanceof TypeSafeError && error.errorType === 'max_tokens_exceeded';

/** `{"detail":{"error_type":"..."}}`, the shape of the API's errors. */
function errorTypeOf(body: string): string | null {
	try {
		const type = (JSON.parse(body) as { detail?: { error_type?: unknown } })?.detail?.error_type;
		return typeof type === 'string' ? type : null;
	} catch {
		return null;
	}
}

/**
 * Waits before the second and third attempt. Short, because every caller has a
 * fallback: a provider that is still failing after these is better answered by
 * the prompt than by waiting longer.
 */
const RETRY_DELAYS_MS = [1_000, 3_000];

/**
 * One System One call. Retries a rate limit (429), an overload (529), any
 * other server error and a dropped connection. Everything else fails at once,
 * including a state over the model's size limit (isOversize), which no retry
 * would change.
 */
export async function systemOne(
	request: SystemOneRequest,
	apiKey: string = config.typesafeApiKey
): Promise<SystemOneResponse> {
	if (!apiKey) throw new Error('TypeSafe: SJS_LLM_API_KEY_TYPESAFE is not set');
	const body = JSON.stringify(request);
	for (let attempt = 0; ; attempt++) {
		let status = 0;
		let detail: string;
		try {
			const res = await fetch(ENDPOINT, {
				method: 'POST',
				headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
				body,
				signal: AbortSignal.timeout(30_000)
			});
			status = res.status;
			if (res.ok) return (await res.json()) as SystemOneResponse;
			detail = (await res.text()).slice(0, 300);
		} catch (error) {
			detail = error instanceof Error ? error.message : String(error);
		}
		const retryable = status === 0 || status === 429 || status >= 500;
		if (!retryable || attempt >= RETRY_DELAYS_MS.length) {
			throw new TypeSafeError(
				`TypeSafe ${status ? `HTTP ${status}` : 'request failed'}: ${detail}`,
				status,
				status ? errorTypeOf(detail) : null
			);
		}
		await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
	}
}
