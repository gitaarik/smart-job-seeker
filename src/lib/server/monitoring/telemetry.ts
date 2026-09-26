/**
 * One telemetry entry point for every process that makes model calls: the app,
 * the worker, the scraper agent and scripts. It starts Sentry, makes sure a
 * context manager exists, and, when the Langfuse keys are set, gives Langfuse a
 * tracer provider of its own. See planning/LANGFUSE.md § Telemetry module.
 *
 * ## Why Langfuse gets its own provider, trace ids and sampler
 *
 * Sentry registers OpenTelemetry's global provider, context manager and
 * propagator when it initialises, even with `tracesSampleRate: 0`, and those
 * globals go to whoever registers first. So Langfuse's provider is handed to the
 * Langfuse SDK (`setLangfuseTracerProvider`) and never registered. That alone is
 * not enough, because the context is still shared: inside `Sentry.startSpan`, or
 * an incoming HTTP request, the ambient span is Sentry's and unsampled, and a
 * provider with the default parent-based sampler drops every span under it
 * (measured 2026-09-24). Hence two rules. Every root gets a trace id of its own
 * (`startTrace`), and the sampler decides from the trace id and never from the
 * parent's flags.
 *
 * Without LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY nothing is traced, and
 * `startTrace` just runs its work, so the open-source app runs unchanged.
 */

import {
	context,
	createContextKey,
	type Context,
	type SpanContext,
	TraceFlags
} from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { type Sampler, SamplingDecision, type SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import {
	createTraceId,
	type LangfuseObservationType,
	setLangfuseTracerProvider,
	startActiveObservation
} from '@langfuse/tracing';
import { propagateAttributes } from '@langfuse/core';
import { getEnvironmentName, initSentry, type ProcessComponent } from './sentry';

export type { ProcessComponent } from './sentry';

/** Which sampling rate a trace falls under. It rides in the context `startTrace` sets up. */
export type SampleGroup = 'matcher' | 'default';

/**
 * The share of traces kept, per environment and group; a group not listed keeps
 * everything. The matcher is most of the volume and the least interesting call
 * by call, so it is the one sampled.
 */
const SAMPLE_RATES: Record<string, Partial<Record<SampleGroup, number>>> = {
	development: { matcher: 0.25 },
	preview: { matcher: 0.05 },
	production: { matcher: 0.05 }
};

const SAMPLE_GROUP = createContextKey('sjs.telemetry.sample-group');
const SJS_ROOT = createContextKey('sjs.telemetry.root');

/**
 * The parent span id every root claims. Langfuse draws an observation whose
 * parent is not in the trace as the trace's root; the id only has to be valid.
 */
const ROOT_PARENT_SPAN_ID = '0123456789abcdef';

/** A trace id's first 32 bits as a share of 2^32. Ids are random or sha256-derived, so uniform. */
function traceShare(traceId: string): number {
	return parseInt(traceId.slice(0, 8), 16) / 0x1_0000_0000;
}

/**
 * Keep a trace when its group's rate says so, decided from the trace id alone.
 * Every span of a trace therefore reaches the same answer as its root, and the
 * parent's trace flags, which inside a request are Sentry's unsampled ones,
 * never count.
 */
export function traceSampler(rateOf: (group: SampleGroup) => number): Sampler {
	return {
		shouldSample(ctx: Context, traceId: string) {
			const group = (ctx.getValue(SAMPLE_GROUP) as SampleGroup | undefined) ?? 'default';
			const rate = rateOf(group);
			const keep = rate >= 1 || traceShare(traceId) < rate;
			return { decision: keep ? SamplingDecision.RECORD_AND_SAMPLED : SamplingDecision.NOT_RECORD };
		},
		toString: () => 'SjsTraceSampler'
	};
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// International numbers only (a leading + or 00), plus Dutch mobiles. A looser
// pattern would take dates, ids and "10,000 monthly users" out of the traces.
const PHONE = /(?:\+|\b00)\d[\d\s().-]{7,}\d|\b06[\s-]?(?:\d[\s-]?){7}\d\b/g;

/**
 * What leaves the process: every string with email addresses and phone numbers
 * replaced, at any depth. A profile reaches a prompt as rendered text, so the
 * patterns are what catch it there. The CV itself stays, since it is what a
 * trace is read for.
 */
export function maskTraceData(data: unknown): unknown {
	if (typeof data === 'string') {
		return data.replace(EMAIL, '[email]').replace(PHONE, '[phone]');
	}
	if (Array.isArray(data)) return data.map(maskTraceData);
	if (data && typeof data === 'object') {
		return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, maskTraceData(v)]));
	}
	return data;
}

let provider: NodeTracerProvider | null = null;
let initialised = false;
/** Which process sent a trace, in its metadata; the environment is the same for all. */
let processName: ProcessComponent | undefined;

export interface Telemetry {
	/** Whether traces leave the process at all. */
	enabled: boolean;
	/** Send what is batched. Scripts call it before they exit. */
	flush(): Promise<void>;
	/** Flush and stop. The worker calls it when it shuts down. */
	shutdown(): Promise<void>;
}

/** Whether `initTelemetry` gave Langfuse a provider in this process. */
export function isTelemetryEnabled(): boolean {
	return provider !== null;
}

/**
 * Start Sentry, a context manager when none is registered, and Langfuse when its
 * keys are set. Idempotent. `spanProcessors` replaces Langfuse's processor, for
 * tests that export to memory.
 */
export function initTelemetry(
	component: ProcessComponent,
	options: { spanProcessors?: SpanProcessor[] } = {}
): Telemetry {
	if (!initialised) {
		initialised = true;
		processName = component;
		initSentry(component);

		// Sentry registers one when it has a DSN. Without one (a script, the scraper
		// agent, a box with no DSN) spans would not nest, so this one takes over.
		const manager = new AsyncLocalStorageContextManager().enable();
		if (!context.setGlobalContextManager(manager)) manager.disable();

		const spanProcessors = options.spanProcessors ?? langfuseProcessors();
		if (spanProcessors.length) {
			const environment = getEnvironmentName();
			provider = new NodeTracerProvider({
				sampler: traceSampler((group) => SAMPLE_RATES[environment]?.[group] ?? 1),
				spanProcessors
			});
			// Never provider.register(): the global belongs to Sentry. See the top.
			setLangfuseTracerProvider(provider);
		}
	}
	return {
		enabled: provider !== null,
		flush: async () => {
			await provider?.forceFlush();
		},
		shutdown: async () => {
			await provider?.shutdown();
		}
	};
}

function langfuseProcessors(): SpanProcessor[] {
	const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
	const secretKey = process.env.LANGFUSE_SECRET_KEY;
	if (!publicKey || !secretKey) return [];
	return [
		new LangfuseSpanProcessor({
			publicKey,
			secretKey,
			baseUrl: process.env.LANGFUSE_BASE_URL,
			environment: getEnvironmentName(),
			mask: ({ data }) => maskTraceData(data)
		})
	];
}

export interface TraceOptions {
	/** What the user or the system did: "assistant turn", "match". */
	name: string;
	/** Langfuse's observation type, only where it is literally true; `span` otherwise. */
	kind?: LangfuseObservationType;
	/**
	 * A natural key for a trace id that can be recomputed, carrying the
	 * environment, since dev and preview share id ranges. Random without one.
	 */
	seed?: string;
	sampleGroup?: SampleGroup;
	userId?: string;
	sessionId?: string;
	tags?: string[];
	/** Strings only, and nothing personal: metadata does not pass the mask. */
	metadata?: Record<string, string>;
}

/** Whether the code is running inside a trace `startTrace` opened. */
export function isInTrace(): boolean {
	return context.active().getValue(SJS_ROOT) === true;
}

/**
 * Run `work` as the root of a trace of its own, with the user, session, tags and
 * metadata propagated to everything under it. With telemetry off it only runs
 * `work`.
 */
export async function startTrace<T>(options: TraceOptions, work: () => Promise<T> | T): Promise<T> {
	if (!provider) return work();

	const group = options.sampleGroup ?? 'default';
	const parentSpanContext: SpanContext = {
		traceId: await createTraceId(options.seed),
		spanId: ROOT_PARENT_SPAN_ID,
		traceFlags: TraceFlags.SAMPLED,
		isRemote: true
	};
	return propagateAttributes(
		{
			traceName: options.name,
			userId: options.userId,
			sessionId: options.sessionId,
			tags: options.tags,
			metadata: { ...options.metadata, sampleGroup: group, process: processName ?? 'unknown' }
		},
		() =>
			context.with(context.active().setValue(SAMPLE_GROUP, group).setValue(SJS_ROOT, true), () =>
				startActiveObservation(options.name, async () => await work(), {
					asType: (options.kind ?? 'span') as 'span',
					parentSpanContext
				})
			)
	);
}
