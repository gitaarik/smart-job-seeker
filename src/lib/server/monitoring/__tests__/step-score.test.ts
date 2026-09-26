/**
 * A step's verdict lands on the observation that is running, under an id that
 * names what it is about, and never happens without a recorded trace.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trace, type Span } from '@opentelemetry/api';

const state = { sends: true };
const mockCreate = vi.fn();

vi.mock('../langfuse-client', () => ({
	langfuseClient: () => ({ score: { create: (...a: unknown[]) => mockCreate(...a) } })
}));
vi.mock('../telemetry', () => ({ sendsToLangfuse: () => state.sends }));
vi.mock('../sentry', () => ({ getEnvironmentName: () => 'development' }));

import { scoreActiveStep } from '../step-score';

/** Make `span` the active one, as a step running inside traceStep is. */
function activeSpan(recording: boolean) {
	vi.spyOn(trace, 'getActiveSpan').mockReturnValue({
		isRecording: () => recording,
		spanContext: () => ({ traceId: 't1', spanId: 's1', traceFlags: 1 })
	} as unknown as Span);
}

beforeEach(() => {
	vi.clearAllMocks();
	state.sends = true;
});
afterEach(() => vi.restoreAllMocks());

describe('scoreActiveStep', () => {
	it('scores the active observation with the category and the reason', () => {
		activeSpan(true);
		scoreActiveStep('judge_verdict', 'scraper-agent:7:1:iteration:2', 'not met', 'only 40%');

		expect(mockCreate).toHaveBeenCalledWith({
			id: 'development:judge_verdict:scraper-agent:7:1:iteration:2',
			environment: 'development',
			traceId: 't1',
			observationId: 's1',
			name: 'judge_verdict',
			value: 'not met',
			dataType: 'CATEGORICAL',
			comment: 'only 40%'
		});
	});

	it('does nothing in a trace the sampler dropped, outside one, or without Langfuse', () => {
		activeSpan(false);
		scoreActiveStep('judge_verdict', 'a', 'met');

		vi.spyOn(trace, 'getActiveSpan').mockReturnValue(undefined);
		scoreActiveStep('judge_verdict', 'b', 'met');

		activeSpan(true);
		state.sends = false;
		scoreActiveStep('judge_verdict', 'c', 'met');

		expect(mockCreate).not.toHaveBeenCalled();
	});
});
