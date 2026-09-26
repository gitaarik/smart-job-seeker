/**
 * Langfuse's API client, for everything besides tracing: prompts, datasets,
 * experiments and scores (planning/LANGFUSE.md). Tracing is telemetry.ts.
 *
 * One module, so every caller shares this copy of the SDK, cloud's scripts
 * included: an experiment's spans go through the tracer provider telemetry.ts
 * gave `@langfuse/tracing`, and a second copy of the SDK would not see it.
 */

import { LangfuseClient } from '@langfuse/client';

export type {
	Evaluation,
	Evaluator,
	ExperimentItemResult,
	ExperimentTaskParams,
	RunEvaluator
} from '@langfuse/client';
export { LANGFUSE_SDK_EXPERIMENT_ENVIRONMENT } from '@langfuse/core';

/** The client for the project the environment's keys name, or null without keys. */
export function langfuseClient(timeoutSeconds = 30): LangfuseClient | null {
	const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
	const secretKey = process.env.LANGFUSE_SECRET_KEY;
	if (!publicKey || !secretKey) return null;
	return new LangfuseClient({
		publicKey,
		secretKey,
		baseUrl: process.env.LANGFUSE_BASE_URL || undefined,
		timeout: timeoutSeconds
	});
}
