/**
 * The Umami wrapper's event data.
 *
 * `track()` grew an optional data argument for the funnel events. The property
 * worth pinning is that an event without data is still sent with ONE argument:
 * Umami treats `track(name, undefined)` the same today, but every existing
 * event name was recorded through the one-argument call and there is no reason
 * to find out whether a future script version agrees.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

const umamiTrack = vi.fn();

beforeEach(() => {
	vi.resetModules();
	umamiTrack.mockReset();
	vi.stubGlobal('window', { umami: { track: umamiTrack } });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('track', () => {
	it('sends a bare event with exactly one argument', async () => {
		const { track } = await import('../analytics');

		track('signup_submitted');

		expect(umamiTrack).toHaveBeenCalledTimes(1);
		expect(umamiTrack.mock.calls[0]).toEqual(['signup_submitted']);
	});

	it('passes event data through when given', async () => {
		const { track } = await import('../analytics');

		track('pricing_plan_clicked', { plan: 'hunter', next: 'signup' });

		expect(umamiTrack).toHaveBeenCalledWith('pricing_plan_clicked', {
			plan: 'hunter',
			next: 'signup'
		});
	});

	it('never lets an analytics failure reach the caller', async () => {
		umamiTrack.mockImplementation(() => {
			throw new Error('blocked');
		});
		const { track } = await import('../analytics');

		expect(() => track('signup_completed', { from: 'test' })).not.toThrow();
	});
});
