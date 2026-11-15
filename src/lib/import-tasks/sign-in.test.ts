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
	it('accepts the two modes the column stores', () => {
		for (const mode of ['manual', 'none']) {
			expect(isLoginMode(mode), mode).toBe(true);
		}
	});

	// "auto" typed a password the server held. The server holds none since
	// 2026-11-14, so the value is no longer a mode; old rows were migrated.
	it('rejects anything else, the retired "auto" included', () => {
		for (const value of ['', 'auto', 'AUTO', 'login', null, undefined, 1, {}]) {
			expect(isLoginMode(value), String(value)).toBe(false);
		}
	});

	it('falls back to signing in rather than leaving a chooser blank', () => {
		expect(toLoginMode('none')).toBe('none');
		expect(toLoginMode(null)).toBe('manual');
		expect(toLoginMode('auto')).toBe('manual');
		expect(toLoginMode('nonsense')).toBe('manual');
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
});

describe('signInApplies', () => {
	it('is true only when a mode that logs in meets a page to log in on', () => {
		expect(signInApplies('manual', true)).toBe(true);
	});

	it('is false for both silent no-ops', () => {
		// Mode asks for a login, platform has no page: handleLoginPhase returns
		// immediately and the run walks into the wall.
		expect(signInApplies('manual', false)).toBe(false);
		// Platform has a page, mode skips it.
		expect(signInApplies('none', true)).toBe(false);
	});
});

describe('loginModeOptions', () => {
	it('offers both modes, signing in first', () => {
		expect(loginModeOptions('LinkedIn').map((o) => o.key)).toEqual(['manual', 'none']);
	});

	it('names the site so the choice reads as being about that site', () => {
		const manual = describeLoginMode('manual', 'LinkedIn');
		expect(manual.help).toContain('LinkedIn');
	});

	it('falls back to a neutral noun when the platform has no name yet', () => {
		const manual = describeLoginMode('manual', null);
		expect(manual.help).toContain('this site');
	});

	// Users of the old three-way chooser inferred from a login URL field that
	// storing a password was mandatory. The help now says it never leaves the
	// browser, and no option may claim to store one.
	it('says the password stays in the browser, and no mode stores one', () => {
		expect(describeLoginMode('manual').help).toMatch(/never leaves your browser/i);
		for (const option of loginModeOptions()) {
			expect(option.help, option.key).not.toMatch(/we store/i);
		}
	});
});

describe('explainMissingSignInPage', () => {
	it('warns when a task asks to sign in somewhere we have no sign-in page for', () => {
		const message = explainMissingSignInPage('manual', false, 'Acme Careers');
		expect(message).toContain('Acme Careers');
		expect(message).toMatch(/no sign-in page/i);
	});

	it('says nothing when the page exists or the task never signs in', () => {
		expect(explainMissingSignInPage('manual', true, 'LinkedIn')).toBeNull();
		expect(explainMissingSignInPage('none', false, 'RemoteOK')).toBeNull();
	});
});

describe('signInNoticeForNewTask', () => {
	it('promises the first run will stop rather than fail quietly', () => {
		const notice = signInNoticeForNewTask('Indeed');
		expect(notice).toContain('Indeed');
		expect(notice).toMatch(/first run/i);
	});

	it('no longer points at stored credentials, which do not exist', () => {
		expect(signInNoticeForNewTask('Indeed')).not.toMatch(/stored credentials/i);
	});
});
