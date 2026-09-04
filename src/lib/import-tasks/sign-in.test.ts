import { describe, expect, it } from 'vitest';
import {
	defaultLoginMode,
	describeLoginMode,
	explainMissingSignInPage,
	isLoginMode,
	loginModeOptions,
	signInApplies,
	signInNoticeForNewTask,
	toLoginMode
} from './sign-in';

describe('isLoginMode / toLoginMode', () => {
	it('accepts the three modes the column stores', () => {
		for (const mode of ['auto', 'manual', 'none']) {
			expect(isLoginMode(mode), mode).toBe(true);
		}
	});

	it('rejects anything else', () => {
		for (const value of ['', 'AUTO', 'login', null, undefined, 1, {}]) {
			expect(isLoginMode(value), String(value)).toBe(false);
		}
	});

	it('falls back to the column default rather than leaving a chooser blank', () => {
		expect(toLoginMode('manual')).toBe('manual');
		expect(toLoginMode(null)).toBe('auto');
		expect(toLoginMode('nonsense')).toBe('auto');
	});
});

describe('defaultLoginMode', () => {
	// The add form hardcoded "none" for every platform picked from the
	// dropdown, so a LinkedIn task could never log in and nothing said so.
	it('offers to sign in when the site has a sign-in page', () => {
		expect(defaultLoginMode(true)).toBe('manual');
	});

	it('stays out of the way when it has none', () => {
		expect(defaultLoginMode(false)).toBe('none');
	});

	it('never defaults to auto, which needs a password the add form does not ask for', () => {
		expect(defaultLoginMode(true)).not.toBe('auto');
		expect(defaultLoginMode(false)).not.toBe('auto');
	});
});

describe('signInApplies', () => {
	it('is true only when a mode that logs in meets a page to log in on', () => {
		expect(signInApplies('manual', true)).toBe(true);
		expect(signInApplies('auto', true)).toBe(true);
	});

	it('is false for both silent no-ops', () => {
		// Mode asks for a login, platform has no page: handleLoginPhase returns
		// immediately and the run walks into the wall.
		expect(signInApplies('auto', false)).toBe(false);
		expect(signInApplies('manual', false)).toBe(false);
		// Platform has a page, mode skips it.
		expect(signInApplies('none', true)).toBe(false);
	});
});

describe('loginModeOptions', () => {
	it('offers all three modes, manual first', () => {
		expect(loginModeOptions('LinkedIn').map((o) => o.key)).toEqual(['manual', 'auto', 'none']);
	});

	it('names the site so the choice reads as being about that site', () => {
		const auto = describeLoginMode('auto', 'LinkedIn');
		expect(auto.help).toContain('LinkedIn');
	});

	it('falls back to a neutral noun when the platform has no name yet', () => {
		const manual = describeLoginMode('manual', null);
		expect(manual.help).toContain('this site');
	});

	// The trade-off is the whole point of the section: one mode stores a
	// password, the other does not, and the user was left to infer it.
	it('says which mode stores a password and which does not', () => {
		expect(describeLoginMode('auto').help).toMatch(/store/i);
		expect(describeLoginMode('manual').help).toMatch(/no password is stored/i);
	});
});

describe('explainMissingSignInPage', () => {
	it('warns when a task asks to sign in somewhere we have no sign-in page for', () => {
		const message = explainMissingSignInPage('auto', false, 'Acme Careers');
		expect(message).toContain('Acme Careers');
		expect(message).toMatch(/no sign-in page/i);
	});

	it('says nothing when the page exists or the task never signs in', () => {
		expect(explainMissingSignInPage('auto', true, 'LinkedIn')).toBeNull();
		expect(explainMissingSignInPage('none', false, 'RemoteOK')).toBeNull();
	});
});

describe('signInNoticeForNewTask', () => {
	it('promises the first run will stop rather than fail quietly', () => {
		const notice = signInNoticeForNewTask('Indeed');
		expect(notice).toContain('Indeed');
		expect(notice).toMatch(/first run/i);
	});
});
