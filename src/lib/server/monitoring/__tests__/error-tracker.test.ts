/**
 * What reaches Sentry, and at what weight.
 *
 * `logError` was the only method that knew Sentry existed, so on a box with a
 * DSN configured a warning reached the container log and nothing else. The fix
 * is not "send them all as events": `withRetry` logs one warning per attempt,
 * so a provider having a bad hour would fill the issue list. They are
 * breadcrumbs, which cost nothing until an error follows them and then say what
 * led up to it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	captureException: vi.fn(),
	addBreadcrumb: vi.fn(),
	isProduction: false
}));

vi.mock('../sentry', () => ({
	Sentry: { captureException: mocks.captureException, addBreadcrumb: mocks.addBreadcrumb }
}));

vi.mock('$lib/server/config', () => ({
	config: {
		get isProduction() {
			return mocks.isProduction;
		}
	}
}));

const { errorTracker } = await import('../error-tracker');

const originalDsn = process.env.SENTRY_DSN;

beforeEach(() => {
	vi.clearAllMocks();
	mocks.isProduction = false;
	process.env.SENTRY_DSN = 'https://key@sentry.example.com/1';
	// The console is the other half of every one of these calls; silence it so a
	// passing run is readable.
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	if (originalDsn === undefined) delete process.env.SENTRY_DSN;
	else process.env.SENTRY_DSN = originalDsn;
});

describe('errorTracker', () => {
	it('sends an error as an event, with its context', () => {
		errorTracker.logError('Upload failed', new Error('boom'), { operation: 'saveMedia' });

		expect(mocks.captureException).toHaveBeenCalledTimes(1);
		const [err, opts] = mocks.captureException.mock.calls[0];
		expect((err as Error).message).toBe('boom');
		expect(opts.contexts.custom).toMatchObject({ operation: 'saveMedia' });
		expect(mocks.addBreadcrumb).not.toHaveBeenCalled();
	});

	it("carries a scraper step's decoration into the context", () => {
		const err = Object.assign(new Error('step failed'), { sjsStep: { runId: 7, name: 'login' } });
		errorTracker.logError('Scrape failed', err);

		const [, opts] = mocks.captureException.mock.calls[0];
		expect(opts.contexts.custom.metadata.sjsStep).toEqual({ runId: 7, name: 'login' });
	});

	it('sends a warning as a breadcrumb, not an event', () => {
		errorTracker.logWarning('Retry attempt 1/3 after 1000ms', {
			operation: 'withRetry',
			metadata: { attempt: 1 }
		});

		expect(mocks.captureException).not.toHaveBeenCalled();
		expect(mocks.addBreadcrumb).toHaveBeenCalledWith(
			expect.objectContaining({
				level: 'warning',
				message: 'Retry attempt 1/3 after 1000ms',
				data: { operation: 'withRetry', metadata: { attempt: 1 } }
			})
		);
	});

	it('times breadcrumbs in seconds, which is what Sentry reads', () => {
		errorTracker.logInfo('Started');
		const { timestamp } = mocks.addBreadcrumb.mock.calls[0][0];
		// Milliseconds here would date every breadcrumb to the year 56000.
		expect(Math.abs(timestamp - Date.now() / 1000)).toBeLessThan(5);
	});

	it('keeps debug out of production entirely', () => {
		mocks.isProduction = true;
		errorTracker.logDebug('Starting operation: match');

		expect(mocks.addBreadcrumb).not.toHaveBeenCalled();
		expect(console.debug).not.toHaveBeenCalled();
	});

	it('logs to the console but not to Sentry when no DSN is configured', () => {
		delete process.env.SENTRY_DSN;

		errorTracker.logWarning('Non-retryable error encountered, not retrying');
		errorTracker.logError('Upload failed', new Error('boom'));

		expect(console.warn).toHaveBeenCalled();
		expect(console.error).toHaveBeenCalled();
		expect(mocks.addBreadcrumb).not.toHaveBeenCalled();
		expect(mocks.captureException).not.toHaveBeenCalled();
	});
});
