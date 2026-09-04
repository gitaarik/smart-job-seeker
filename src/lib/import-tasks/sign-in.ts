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
 * task page and the credential picker all read their words from here, so the
 * three cannot drift into describing different behaviour.
 *
 * Pure and dependency-free, like its neighbours `readiness.ts` and
 * `failure-policy.ts`: it runs in the browser (both forms) and on the server
 * (the create action's default).
 */

export const LOGIN_MODES = ['auto', 'manual', 'none'] as const;
export type LoginMode = (typeof LOGIN_MODES)[number];

export function isLoginMode(value: unknown): value is LoginMode {
	return typeof value === 'string' && (LOGIN_MODES as readonly string[]).includes(value);
}

/**
 * Read a task's stored mode. The column defaults to "auto" and is `notNull`,
 * but rows predate the constraint and callers hand us `any`-typed task rows,
 * so anything unrecognised falls back rather than rendering a chooser with
 * nothing selected.
 */
export function toLoginMode(value: unknown): LoginMode {
	return isLoginMode(value) ? value : 'auto';
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
 * taught what this site needs. "auto" is not a default because it needs a
 * stored password the add form deliberately does not collect.
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
 * The three options, in the order they are offered.
 *
 * The help text is where the security trade-off gets stated, because this is
 * the only screen where the choice is made: "auto" is the mode that puts a
 * password in our database, "manual" is the mode that does not. Users were
 * left to infer that from a login URL field, and mostly inferred that storing
 * credentials was mandatory.
 */
export function loginModeOptions(platformName?: string | null): LoginModeCopy[] {
	const site = platformName?.trim() || 'this site';
	return [
		{
			key: 'manual',
			label: 'I sign in myself',
			help: `The run opens ${site}'s sign-in page and waits while you sign in through Browser View. The browser keeps the session, so later runs go straight to the jobs. No password is stored here.`
		},
		{
			key: 'auto',
			label: 'Sign in automatically',
			help: `We store a username and password for ${site}, encrypted, and fill them in on every run. Use this for scheduled runs, when nobody is there to sign in.`
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
 * "auto" at the column level, so every task ever created on a public board
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
	return `${site} asks you to sign in. The first run stops at the sign-in page so you can sign in yourself, and the browser stays signed in after that. You can switch to stored credentials on the task page.`;
}
