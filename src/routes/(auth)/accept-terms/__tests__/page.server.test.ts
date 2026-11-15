/**
 * The POST behind /accept-terms. The load already refuses an impersonating
 * admin and a demo copy; a form posted straight to the action skips the load,
 * so the action has to refuse them too or it records an agreement nobody gave.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordTermsAcceptance = vi.fn(async (_userId: string) => {});
vi.mock('$lib/server/legal/texts', () => ({ termsVersion: () => '2026-11-13' }));
vi.mock('$lib/server/legal/record', () => ({
	acceptedTermsField: (form: FormData) => form.get('accept') === 'on',
	recordTermsAcceptance
}));

const { actions } = await import('../+page.server');

type User = { id: string; terms_version?: string | null; is_demo?: boolean };

function event(user: User | null, adminUser: User | null = null, accept = true) {
	const form = new FormData();
	if (accept) form.set('accept', 'on');
	return {
		locals: { user, adminUser },
		request: new Request('http://localhost/accept-terms?redirect=/jobs', {
			method: 'POST',
			body: form
		}),
		url: new URL('http://localhost/accept-terms?redirect=/jobs')
	} as unknown as Parameters<typeof actions.default>[0];
}

async function run(e: ReturnType<typeof event>) {
	try {
		return { result: await actions.default(e) };
	} catch (thrown) {
		return { thrown: thrown as { status?: number; location?: string } };
	}
}

beforeEach(() => recordTermsAcceptance.mockClear());

describe('accept-terms action', () => {
	it('records the account owner accepting, then returns them', async () => {
		const { thrown } = await run(event({ id: 'u1', terms_version: null }));
		expect(recordTermsAcceptance).toHaveBeenCalledWith('u1');
		expect(thrown).toMatchObject({ status: 302, location: '/jobs' });
	});

	it('refuses an admin impersonating the account', async () => {
		const { result } = await run(
			event({ id: 'u1', terms_version: null }, { id: 'admin', terms_version: '2026-11-13' })
		);
		expect(result).toMatchObject({ status: 403 });
		expect(recordTermsAcceptance).not.toHaveBeenCalled();
	});

	it('records nothing for a demo copy or an account already current', async () => {
		for (const user of [
			{ id: 'demo', terms_version: null, is_demo: true },
			{ id: 'u2', terms_version: '2026-11-13' }
		]) {
			const { thrown } = await run(event(user));
			expect(thrown).toMatchObject({ status: 302, location: '/jobs' });
		}
		expect(recordTermsAcceptance).not.toHaveBeenCalled();
	});

	it('asks again when the box is not ticked', async () => {
		const { result } = await run(event({ id: 'u1', terms_version: null }, null, false));
		expect(result).toMatchObject({ status: 400 });
		expect(recordTermsAcceptance).not.toHaveBeenCalled();
	});
});
