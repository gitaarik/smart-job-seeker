/**
 * A process that traces without Sentry, as the child processes the worker runs
 * scrapes in do (cloud src/processors/scrape-tracing.ts). A file of its own,
 * because telemetry starts once per process and telemetry.test.ts starts it
 * with Sentry.
 */

import { expect, it } from 'vitest';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { startActiveObservation } from '@langfuse/tracing';
import { Sentry } from '../sentry';
import { initTelemetry, startTrace } from '../telemetry';

it('traces, nests and names its process, and leaves Sentry off despite a DSN', async () => {
	process.env.SENTRY_DSN = 'https://public@example.invalid/1';
	const exporter = new InMemorySpanExporter();
	const telemetry = initTelemetry('scraper', {
		sentry: false,
		spanProcessors: [
			new LangfuseSpanProcessor({
				exporter,
				exportMode: 'immediate',
				publicKey: 'pk-lf-test',
				secretKey: 'sk-lf-test'
			})
		]
	});

	await startTrace({ name: 'helper call', sessionId: 'scrape-run:7' }, () =>
		startActiveObservation('child', async () => {})
	);
	await telemetry.flush();

	expect(Sentry.getClient()).toBeUndefined();
	const spans = exporter.getFinishedSpans();
	const root = spans.find((s) => s.name === 'helper call');
	const child = spans.find((s) => s.name === 'child');
	expect(root, 'the root was exported').toBeDefined();
	expect(child?.parentSpanContext?.spanId).toBe(root!.spanContext().spanId);
	expect(root!.attributes['session.id']).toBe('scrape-run:7');
	expect(root!.attributes['langfuse.trace.metadata.process']).toBe('scraper');
});
