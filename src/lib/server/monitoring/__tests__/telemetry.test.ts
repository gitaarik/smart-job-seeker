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
import {
	initTelemetry,
	inOpenTrace,
	isInTrace,
	maskTraceData,
	recordedTraceId,
	startTrace,
	traceGeneration,
	traceStep,
	withTraceAttributes,
	type Telemetry
} from '../telemetry';

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

describe('steps and what a row keeps', () => {
	const find = (name: string) => exporter.getFinishedSpans().find((s) => s.name === name);

	it('records a step inside the open trace, and nothing outside one', async () => {
		await traceStep('alone', 'span', async () => 1);
		await startTrace({ name: 'unit' }, () =>
			traceStep(
				'step',
				'retriever',
				async () => ['a pick'],
				(picks) => ({ output: picks })
			)
		);
		await telemetry.flush();

		expect(find('alone'), 'a step never opens a trace of its own').toBeUndefined();
		const step = find('step')!;
		expect(step.parentSpanContext?.spanId).toBe(find('unit')!.spanContext().spanId);
		expect(step.attributes['langfuse.observation.type']).toBe('retriever');
		expect(step.attributes['langfuse.observation.output']).toBe('["a pick"]');
	});

	it('records a step that throws at ERROR and rethrows', async () => {
		const failing = startTrace({ name: 'unit' }, () =>
			traceStep('step', 'span', async () => {
				throw new Error('no vectors');
			})
		);
		await expect(failing).rejects.toThrow('no vectors');
		await telemetry.flush();

		expect(find('step')!.attributes['langfuse.observation.level']).toBe('ERROR');
		expect(find('step')!.attributes['langfuse.observation.status_message']).toBe('no vectors');
	});

	it('records a throw that is how the work stops as a stop, not an ERROR, and rethrows it', async () => {
		const pause = new Error('GraphInterrupt');
		const expected = (error: unknown) => (error === pause ? 'waiting for an answer' : undefined);
		const run = startTrace({ name: 'session', input: { goal: 'most items' }, expected }, () =>
			traceStep(
				'ask',
				'span',
				async () => {
					throw pause;
				},
				undefined,
				{ input: 'the question', metadata: { langgraph_node: 'ask', langgraph_step: 4 }, expected }
			)
		);
		expect(await run.catch((error: unknown) => error)).toBe(pause);
		await telemetry.flush();

		for (const name of ['session', 'ask']) {
			expect(find(name)!.attributes['langfuse.observation.level'], name).toBeUndefined();
			expect(find(name)!.attributes['langfuse.observation.status_message'], name).toBe(
				'waiting for an answer'
			);
		}
		// Recorded as each started, so a step that never returned still has them.
		expect(find('session')!.attributes['langfuse.observation.input']).toBe('{"goal":"most items"}');
		expect(find('ask')!.attributes['langfuse.observation.input']).toBe('the question');
		expect(find('ask')!.attributes['langfuse.observation.metadata.langgraph_node']).toBe('ask');
		expect(find('ask')!.attributes['langfuse.observation.metadata.langgraph_step']).toBe('4');
	});

	it('still records any other throw at ERROR when a step knows its stops', async () => {
		const run = startTrace({ name: 'unit' }, () =>
			traceStep(
				'step',
				'span',
				async () => {
					throw new Error('run 12 not found');
				},
				undefined,
				{ expected: () => undefined }
			)
		);
		await expect(run).rejects.toThrow('run 12 not found');
		await telemetry.flush();

		expect(find('step')!.attributes['langfuse.observation.level']).toBe('ERROR');
		expect(find('step')!.attributes['langfuse.observation.status_message']).toBe(
			'run 12 not found'
		);
	});

	it('records a model call made outside the wrapper as a generation', async () => {
		await traceGeneration(
			'claude',
			'fix the selector',
			async () => 'done',
			() => ({
				output: 'done'
			})
		);
		await startTrace({ name: 'unit' }, () =>
			traceGeneration(
				'claude',
				'fix the selector',
				async () => ({ text: 'Fixed.' }),
				(reply) => ({
					output: reply.text,
					model: 'claude-sonnet-5',
					usageDetails: { input: 12, input_cached_tokens: 3000, output: 40 },
					costDetails: { total: 0.21 }
				})
			)
		);
		await telemetry.flush();

		const generations = exporter.getFinishedSpans().filter((s) => s.name === 'claude');
		expect(generations, 'only inside a trace').toHaveLength(1);
		const attributes = generations[0].attributes;
		expect(attributes['langfuse.observation.type']).toBe('generation');
		expect(attributes['langfuse.observation.input']).toBe('fix the selector');
		expect(attributes['langfuse.observation.output']).toBe('Fixed.');
		expect(attributes['langfuse.observation.model.name']).toBe('claude-sonnet-5');
		expect(JSON.parse(String(attributes['langfuse.observation.usage_details']))).toEqual({
			input: 12,
			input_cached_tokens: 3000,
			output: 40
		});
		expect(JSON.parse(String(attributes['langfuse.observation.cost_details']))).toEqual({
			total: 0.21
		});
	});

	it("records what describe makes of a root's result on the root", async () => {
		await startTrace(
			{ name: 'case', environment: 'smoke' },
			async () => [false, 'n=0'] as const,
			([passed, detail]) => ({ output: { passed, detail }, level: 'WARNING' })
		);
		await telemetry.flush();

		expect(find('case')!.attributes['langfuse.observation.level']).toBe('WARNING');
		expect(find('case')!.attributes['langfuse.environment']).toBe('smoke');
	});

	it('gives a row the id of a trace that is recorded, and none otherwise', async () => {
		expect(recordedTraceId(), 'outside a trace').toBeNull();

		let kept: string | null = null;
		await startTrace({ name: 'kept', seed: 'row-kept' }, () => {
			kept = recordedTraceId();
		});
		await telemetry.flush();
		expect(kept).toBe(find('kept')!.spanContext().traceId);

		// A matcher trace the sampler drops (SAMPLE_RATES: a quarter on dev).
		let seed = 0;
		const share = (id: string) => parseInt(id.slice(0, 8), 16) / 2 ** 32;
		while (share(await createTraceId(`row-dropped-${seed}`)) < 0.25) seed++;
		let dropped: string | null = 'unset';
		await startTrace(
			{ name: 'dropped', seed: `row-dropped-${seed}`, sampleGroup: 'matcher' },
			() => {
				dropped = recordedTraceId();
			}
		);
		expect(dropped, 'a dropped trace never reaches Langfuse').toBeNull();
	});

	it("puts a run's traces in its session, unless a trace names its own user", async () => {
		await withTraceAttributes({ userId: 'owner', sessionId: 'scrape-run:7' }, async () => {
			await startTrace({ name: 'helper' }, async () => {});
			await startTrace({ name: 'import', userId: 'someone else' }, async () => {});
		});
		await telemetry.flush();

		expect(find('helper')!.attributes['session.id']).toBe('scrape-run:7');
		expect(find('helper')!.attributes['user.id']).toBe('owner');
		expect(find('import')!.attributes['session.id']).toBe('scrape-run:7');
		expect(find('import')!.attributes['user.id']).toBe('someone else');
	});

	it('joins a trace somebody else opened, as a Langfuse experiment item does', async () => {
		let joined = false;
		await startActiveObservation('experiment-item-run', async () => {
			await inOpenTrace(async () => {
				joined = isInTrace();
				await startActiveObservation('call', async () => {});
			}, 'sdk-experiment');
		});
		await telemetry.flush();

		expect(joined, 'calls inside nest instead of opening traces of their own').toBe(true);
		const call = find('call')!;
		expect(call.spanContext().traceId).toBe(find('experiment-item-run')!.spanContext().traceId);
		expect(call.parentSpanContext?.spanId).toBe(find('experiment-item-run')!.spanContext().spanId);
		expect(call.attributes['langfuse.environment']).toBe('sdk-experiment');
	});
});
