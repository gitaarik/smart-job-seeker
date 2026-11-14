/**
 * What "signing in" means for an import task, in one place.
 *
 * Two columns decide whether a run ever authenticates, and neither is any use
 * without the other:
 *
 * - `job_platforms.login_page_url` — no URL, no login phase. `handleLoginPhase`
 *   returns immediately when it is null, *whatever* the task's mode says.
 * - `search_tasks.login_mode` — "none" skips the login phase outright, so a
 *   platform that has a sign-in page still never visits it.
 *
 * Every combination that fails does so silently: the run starts, walks into a
 * login wall, and reports finding no jobs. That is the whole reason this file
 * exists rather than each form spelling the rules out again. The add form, the
 * task page and the account picker all read their words from here, so the
 * three cannot drift into describing different behaviour.
 *
 * Pure and dependency-free, like its neighbours `readiness.ts` and
 * `failure-policy.ts`: it runs in the browser (both forms) and on the server
 * (the create action's default).
 */

/**
 * "manual" is the run signing in as the user would: it opens the sign-in page,
 * and either the user signs in through Browser View or, when the task carries
 * the email address the user signs in with, the run types that address and
 * the verification relay answers the emailed code. There is no mode that
 * types a stored password: the server stopped holding platform passwords on
 * 2026-11-14 (sjs-ops planning/PLATFORM-PASSWORDS-REMOVED.md). Tasks saved
 * with the old "auto" value were moved to "manual" by migration 0111.
 */
export const LOGIN_MODES = ['manual', 'none'] as const;
export type LoginMode = (typeof LOGIN_MODES)[number];

export function isLoginMode(value: unknown): value is LoginMode {
	return typeof value === 'string' && (LOGIN_MODES as readonly string[]).includes(value);
}

/**
 * Read a task's stored mode. The column defaults to "manual" and is `notNull`,
 * but callers hand us `any`-typed task rows and old API clients may still send
 * "auto", so anything unrecognised falls back to signing in rather than
 * rendering a chooser with nothing selected.
 */
export function toLoginMode(value: unknown): LoginMode {
	return isLoginMode(value) ? value : 'manual';
}

/**
 * The mode a *newly created* task should get.
 *
 * "manual" for a site with a sign-in page, and this is the correction the add
 * form needed: it hardcoded "none" for everything picked from the dropdown,
 * which on the 14 of 24 published platforms that have a sign-in page (LinkedIn,
 * Indeed, Upwork...) produced a task that could never log in, with nothing in
 * the UI saying so. The failure surfaced as an empty import.
 *
 * "manual" costs nothing when the browser is already signed in — the login
 * phase checks that first and walks straight past — and when it is not, the
 * first run stops and asks, which is the only moment the user can actually be
 * taught what this site needs.
 */
export function defaultLoginMode(hasSignInPage: boolean): LoginMode {
	return hasSignInPage ? 'manual' : 'none';
}

/**
 * Will this task's sign-in setting do anything at run time? False for the two
 * silent no-ops: a mode that asks for a login when the platform has no sign-in
 * page on file, and (trivially) "none".
 */
export function signInApplies(mode: LoginMode, hasSignInPage: boolean): boolean {
	return mode !== 'none' && hasSignInPage;
}

export interface LoginModeCopy {
	key: LoginMode;
	/** Button / heading label. */
	label: string;
	/** One or two sentences: what the run does, and what it costs. */
	help: string;
}

/**
 * The two options, in the order they are offered.
 *
 * The help text says where the password goes, because this is the only screen
 * where someone could wonder: nowhere. Users of the old three-way chooser
 * mostly inferred from a login URL field that storing credentials was
 * mandatory, so the words stay explicit.
 */
export function loginModeOptions(platformName?: string | null): LoginModeCopy[] {
	const site = platformName?.trim() || 'this site';
	return [
		{
			key: 'manual',
			label: 'Sign in',
			help: `The run opens ${site}'s sign-in page. Sign in once through Browser View and the browser stays signed in for later runs. Your password never leaves your browser.`
		},
		{
			key: 'none',
			label: "Don't sign in",
			help: `Go straight to the jobs. Right when ${site} shows its listings to anyone.`
		}
	];
}

export function describeLoginMode(mode: LoginMode, platformName?: string | null): LoginModeCopy {
	const options = loginModeOptions(platformName);
	return options.find((o) => o.key === mode) ?? options[0];
}

/**
 * The line to show when a task asks for a sign-in but the platform has no
 * sign-in page on file. Returns null when there is nothing to warn about.
 *
 * Deliberately *not* a blocker in `readiness.ts`. `login_mode` defaults to
 * signing in at the column level, so every task ever created on a public board
 * carries a mode it does not need; gating Start on that would refuse runs that
 * work perfectly well today. Saying it where the setting is edited is the
 * honest fix.
 */
export function explainMissingSignInPage(
	mode: LoginMode,
	hasSignInPage: boolean,
	platformName?: string | null
): string | null {
	if (hasSignInPage || mode === 'none') return null;
	const site = platformName?.trim() || 'This site';
	return `${site} has no sign-in page on file, so runs go straight to the jobs and this setting does nothing. Add the sign-in page if the jobs are behind a login.`;
}

/**
 * What the add form says about a site it already knows needs a sign-in. A
 * statement rather than a control: at add time the user has no credentials to
 * hand and no reason to choose, and the task page is the very next screen.
 */
export function signInNoticeForNewTask(platformName?: string | null): string {
	const site = platformName?.trim() || 'This site';
	return `${site} asks you to sign in. The first run stops at the sign-in page so you can sign in yourself, and the browser stays signed in after that.`;
}
