/**
 * The Sentry interaction telemetry.ts exists to survive (planning/LANGFUSE.md
 * § Telemetry module).
 *
 * Sentry owns OpenTelemetry's globals, and inside its spans or an incoming
 * request the ambient span is unsampled. Measured on 2026-09-24, a Langfuse
 * provider with the default sampler dropped every span there, silently. This
 * replays that matrix with Sentry initialised for real (a fake DSN, and nothing
 * is captured, so nothing is sent) and Langfuse's own span processor exporting
 * to memory, so an SDK bump that brings the drop back fails here instead of
 * producing no traces.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { context, trace, TraceFlags } from '@opentelemetry/api';
import { InMemorySpanExporter, type ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { createTraceId, startActiveObservation } from '@langfuse/tracing';
import { Sentry } from '../sentry';
import { initTelemetry, maskTraceData, startTrace, type Telemetry } from '../telemetry';

const exporter = new InMemorySpanExporter();
let telemetry: Telemetry;

beforeAll(() => {
	process.env.SENTRY_DSN = 'https://public@example.invalid/1';
	telemetry = initTelemetry('script', {
		spanProcessors: [
			new LangfuseSpanProcessor({
				exporter,
				exportMode: 'immediate',
				publicKey: 'pk-lf-test',
				secretKey: 'sk-lf-test'
			})
		]
	});
});

beforeEach(() => exporter.reset());

/** A root with one child, then what was exported. */
async function traced(name: string) {
	await startTrace({ name, userId: 'user-1', sessionId: 'session-1' }, () =>
		startActiveObservation('child', async () => {})
	);
	await telemetry.flush();
	const spans = exporter.getFinishedSpans();
	return {
		root: spans.find((s) => s.name === name),
		child: spans.find((s) => s.name === 'child')
	};
}

function expectOneNestedTrace(
	{ root, child }: { root?: ReadableSpan; child?: ReadableSpan },
	ambientTraceId?: string
) {
	expect(root, 'the root was exported').toBeDefined();
	expect(child, 'the child was exported').toBeDefined();
	expect(child!.spanContext().traceId).toBe(root!.spanContext().traceId);
	expect(child!.parentSpanContext?.spanId).toBe(root!.spanContext().spanId);
	// A trace of its own, never a branch of Sentry's.
	if (ambientTraceId) expect(root!.spanContext().traceId).not.toBe(ambientTraceId);
	for (const span of [root!, child!]) {
		expect(span.attributes['user.id']).toBe('user-1');
		expect(span.attributes['session.id']).toBe('session-1');
	}
}

describe('startTrace under Sentry', () => {
	it('exports and nests with no ambient span', async () => {
		expectOneNestedTrace(await traced('bare'));
	});

	it('exports and nests inside Sentry.startSpan, whose span is unsampled', async () => {
		let ambient = '';
		const result = await Sentry.startSpan({ name: 'sentry work' }, (span) => {
			ambient = span.spanContext().traceId;
			return traced('in a sentry span');
		});
		expectOneNestedTrace(result, ambient);
	});

	it('exports and nests under an unsampled ambient span, as an incoming request leaves one', async () => {
		const ambient = {
			traceId: 'a'.repeat(32),
			spanId: 'b'.repeat(16),
			traceFlags: TraceFlags.NONE
		};
		const result = await context.with(trace.setSpanContext(context.active(), ambient), () =>
			traced('in a request')
		);
		expectOneNestedTrace(result, ambient.traceId);
	});
});

describe('sampling', () => {
	it("keeps a matcher trace whole or drops it whole, by its trace id's share", async () => {
		// Development keeps a quarter of the matcher's traces (SAMPLE_RATES).
		const share = (traceId: string) => parseInt(traceId.slice(0, 8), 16) / 2 ** 32;
		const outcomes = new Set<boolean>();
		for (let i = 0; i < 24; i++) {
			const seed = `sampling-${i}`;
			exporter.reset();
			await startTrace({ name: 'match', seed, sampleGroup: 'matcher' }, () =>
				startActiveObservation('child', async () => {})
			);
			await telemetry.flush();
			const kept = share(await createTraceId(seed)) < 0.25;
			outcomes.add(kept);
			expect(exporter.getFinishedSpans()).toHaveLength(kept ? 2 : 0);
		}
		expect(outcomes, 'the seeds cover both outcomes').toEqual(new Set([true, false]));
	});
});

describe('maskTraceData', () => {
	it('replaces email addresses and phone numbers at any depth', () => {
		const data = {
			messages: [{ content: 'Mail rik@example.com, or call +31 6 1234 5678 or 06-12345678.' }]
		};
		expect(maskTraceData(data)).toEqual({
			messages: [{ content: 'Mail [email], or call [phone] or [phone].' }]
		});
	});

	it('leaves dates, years, counts and ids alone', () => {
		const text = 'From 2019-03-01 to 2026-09-25, 10,000 monthly users, order 1234567890.';
		expect(maskTraceData(text)).toBe(text);
	});
});
