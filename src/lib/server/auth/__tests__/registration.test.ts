/**
 * The flag that decides whether an environment accepts new registrations.
 *
 * Worth pinning despite being four lines: it is read from a string, and the
 * failure that matters is asymmetric. A value this does not recognise must
 * come back **closed** — a deploy that mistypes it should stop registrations,
 * not silently open a signup form to the internet on a box nobody meant to
 * launch.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const getEnv = vi.hoisted(() => vi.fn());
vi.mock('$lib/tools/get-env', () => ({ getEnv }));

const { registrationOpen } = await import('../registration');

/** Stand in for the env, honouring the caller's default like the real one. */
function envIs(value: string | undefined) {
	getEnv.mockImplementation((_key: string, fallback: string) => value ?? fallback);
}

afterEach(() => getEnv.mockReset());

describe('registrationOpen', () => {
	it('is closed when nothing is set', () => {
		envIs(undefined);
		expect(registrationOpen()).toBe(false);
	});

	it.each(['true', 'TRUE', ' true ', '1', 'yes', 'Yes'])('opens on %j', (value) => {
		envIs(value);
		expect(registrationOpen()).toBe(true);
	});

	it.each(['false', '0', 'no', '', 'maybe', 'on', 'open'])('stays closed on %j', (value) => {
		envIs(value);
		expect(registrationOpen()).toBe(false);
	});

	it('reads the flag by its documented name', () => {
		envIs('true');
		registrationOpen();
		expect(getEnv).toHaveBeenCalledWith('SJS_REGISTRATION_OPEN', 'false');
	});
});
