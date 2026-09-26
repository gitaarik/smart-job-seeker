/**
 * A verdict on the step that is running, as a Langfuse score on its
 * observation: the scraper agent's judge on its evaluate step, once a round
 * (planning/LANGFUSE.md, Phase 6). What applicants do with what the models
 * wrote is product-scores.ts, which looks its generation up in the database;
 * this needs no more than the span that is active, so it imports no database.
 */
import { trace } from '@opentelemetry/api';
import { langfuseClient } from './langfuse-client';
import { getEnvironmentName } from './sentry';
import { sendsToLangfuse } from './telemetry';

let client: ReturnType<typeof langfuseClient> | undefined;

/**
 * Score the active observation with a category, `met` or `not met`, and the
 * reason as its comment. `about` names what is scored and makes the score's id
 * with its name and the environment, so a step that runs again replaces its
 * verdict rather than adding one. Nothing happens outside a recorded trace.
 */
export function scoreActiveStep(
	name: string,
	about: string,
	value: string,
	comment?: string
): void {
	if (!sendsToLangfuse()) return;
	const span = trace.getActiveSpan();
	if (!span?.isRecording()) return;
	const { traceId, spanId } = span.spanContext();
	const environment = getEnvironmentName();
	client ??= langfuseClient();
	client?.score.create({
		id: `${environment}:${name}:${about}`,
		// Filed with the traces; the client's default is Langfuse's `default`.
		environment,
		traceId,
		observationId: spanId,
		name,
		value,
		dataType: 'CATEGORICAL',
		comment
	});
}
