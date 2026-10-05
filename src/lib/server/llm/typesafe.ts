/**
 * TypeSafe's System One API, which serves Jev: a decision model, not a chat
 * model (https://docs.typesafe.ai/api).
 *
 * It takes a `state` and named questions and answers each one with a value
 * instead of text. The only kind used here is the yes/no question ("noul"),
 * answered with the probability of yes. None of the chat wrapper applies (no
 * messages, no JSON to parse, no response cache), so this is a plain HTTP call.
 */
import { config } from '$lib/server/config';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

export interface NoulQuestion {
	type: 'noul';
	instructions: string;
}

export interface SystemOneRequest {
	model: string;
	state: unknown;
	questions: Record<string, NoulQuestion>;
}

export interface SystemOneResponse {
	model: string;
	answers: Record<string, { type: string; noul?: number }>;
	usage: { input_tokens: number; output_tokens: number };
}

/**
 * Waits before the second and third attempt. Short, because the one caller has
 * a fallback: a provider that is still failing after these is better answered
 * by the prompt than by waiting longer.
 */
const RETRY_DELAYS_MS = [1_000, 3_000];

/**
 * One System One call. Retries a rate limit (429), an overload (529), any
 * other server error and a dropped connection. Everything else fails at once,
 * including the 422 for a state over the model's size limit, which no retry
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
			throw new Error(`TypeSafe ${status ? `HTTP ${status}` : 'request failed'}: ${detail}`);
		}
		await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
	}
}
