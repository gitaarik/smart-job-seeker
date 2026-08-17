/**
 * Machine-readable taxonomy for why a scrape run failed.
 *
 * The scraper has always *known* this — `classifyAuthBlock` distinguishes an
 * emailed login code from a CAPTCHA wall from a rejected password — but the
 * knowledge was immediately flattened into an English sentence in
 * `search_task_runs.error_message` and lost. Anything wanting to act on the
 * cause (auto-disable, back-off, support triage) had to substring-match prose
 * that exists to be read by humans, and would silently stop working the day
 * someone improved the wording.
 *
 * So the classifier now also emits one of these constants, stored alongside
 * the message. The message stays the thing users read; the kind is the thing
 * code branches on. Kinds are append-only — never renamed, never repurposed —
 * because historical rows carry them.
 *
 * Lives in oss rather than next to the scraper in the cloud tree, and outside
 * `$lib/server` rather than in it, because it has three readers in three
 * places: the scraper that writes kinds, the policy that reads them, and the
 * UI that has to explain one to a user. Same reasoning as its neighbour
 * `readiness.ts` — pure and dependency-free, so it can run anywhere.
 */

export const FAILURE_KINDS = [
	// --- Auth family: we reached the platform and could not get in. ---------
	/** Credentials accepted, the site wants more proof: emailed code, 2FA app,
	 *  SMS, "is this you?" device confirmation, security question. */
	'auth_verification',
	/** The stored password was rejected outright. */
	'auth_credentials',
	/** A CAPTCHA / "prove you're human" wall stood in front of the login. */
	'auth_captcha',
	/** The account itself is limited, suspended, or flagged for unusual activity. */
	'auth_restricted',
	/** The platform demands acceptance of new terms before letting us through. */
	'auth_terms',
	/** The browser's own passkey / security-key dialog took the keyboard, so the
	 *  credentials never reached the form. Drawn outside the page, so no
	 *  amount of reading the DOM sees it — see the scraper's
	 *  `login/passkey.ts`. */
	'auth_passkey',
	/** Login failed and the page state didn't match any known pattern. */
	'auth_unknown',

	// --- Everything else ----------------------------------------------------
	/** Network-level: the platform (or the tunnel to the browser) was unreachable. */
	'platform_unreachable',
	/** Our own automation threw — tunnel clickAt timeout, focus verification, IPC. */
	'automation_error',
	/** We got in but couldn't drive the search form. */
	'interaction_failed',
	/** Something took too long. */
	'timeout',
	/** The local/hosted browser went away mid-run. */
	'browser_disconnected',
	/** The platform actively refused us (403 / access denied). */
	'access_denied',
	/** LLM provider quota, auth, or rate limit. */
	'llm_unavailable',
	/** Our infrastructure ended the run — worker restart, shutdown, queue reaper.
	 *  Says nothing about the task, so policies must ignore rather than count it. */
	'infrastructure',
	/** Terminal failure with no recognised cause. */
	'unknown'
] as const;

export type FailureKind = (typeof FAILURE_KINDS)[number];

/**
 * The failures a human can fix, but only by interacting with the platform
 * once — logging in by hand, completing a device check, answering a security
 * question, accepting terms, updating a saved password.
 *
 * What unites them is not severity, it's futility: no amount of retrying
 * unattended will clear one. That is exactly the condition under which
 * re-running a schedule forever is pure waste, so this set is what
 * {@link decideAutoDisable} arms on.
 */
export const AUTH_SETUP_FAILURE_KINDS: readonly FailureKind[] = [
	'auth_verification',
	'auth_credentials',
	'auth_captcha',
	'auth_restricted',
	'auth_terms',
	'auth_passkey',
	'auth_unknown'
];

/** True for failures that need a one-off human interaction with the platform. */
export function isAuthSetupFailure(kind: FailureKind | null | undefined): boolean {
	return kind != null && AUTH_SETUP_FAILURE_KINDS.includes(kind);
}

/**
 * True for failures caused by our own infrastructure rather than by the task.
 *
 * A worker restart tells you nothing about whether the task's login works, so
 * these neither count toward a failure streak nor clear one — the policy skips
 * them entirely.
 */
export function isInfrastructureFailure(kind: FailureKind | null | undefined): boolean {
	return kind === 'infrastructure';
}

/**
 * Phrases in a login *reason* that mean "the password we have stored is
 * wrong", as opposed to a verification step, a lock-out, or a page we failed
 * to read.
 *
 * Deliberately specific rather than a bare "password" match: the reason
 * "No password field found" describes a login page that never rendered, and
 * reading it as a rejected password would send the user to change a password
 * that is perfectly fine. (It did, until a test caught it.)
 *
 * Lives here so the live classifier in the cloud tree and the historical one
 * below share one list. Two copies of a list that must agree is how they stop
 * agreeing.
 */
export const CREDENTIAL_REASON_PHRASES: readonly string[] = [
	'invalid password',
	'incorrect password',
	'wrong password',
	'invalid credentials',
	'incorrect credentials',
	'account not found',
	'user not found',
	'no account found',
	'email or password',
	'username or password',
	'verify your credentials',
	'password field was cleared',
	'credentials may be incorrect'
];

/** True if a login reason means the stored password was rejected. */
export function isCredentialReason(reason: string): boolean {
	const lower = reason.toLowerCase();
	return CREDENTIAL_REASON_PHRASES.some((p) => lower.includes(p));
}

/** Narrow an arbitrary string (e.g. a DB column) to a known kind, else null. */
export function toFailureKind(value: string | null | undefined): FailureKind | null {
	if (!value) return null;
	return (FAILURE_KINDS as readonly string[]).includes(value) ? (value as FailureKind) : null;
}

/**
 * Recover a kind from the `error_message` of a run written before the
 * `failure_kind` column existed.
 *
 * This is the string-matching that the column exists to abolish, and it lives
 * here rather than in the classifier so nothing new is ever tempted to call
 * it: its only job is `scripts/backfill-failure-kinds.ts`, so an install has
 * usable history the day the feature ships instead of three scheduled runs
 * later. The literals are copies of the cloud tree's `ERROR_MESSAGES` and the
 * auth reasons as they were written into these rows — historical text, frozen
 * by having already been persisted, so it will not drift the way live
 * matching would.
 *
 * Returns null when the message matches nothing, which is the honest answer:
 * a run whose cause we can't recover should stay unclassified rather than be
 * guessed into `unknown` and look like a real classification.
 */
export function classifyLegacyErrorMessage(message: string | null | undefined): FailureKind | null {
	if (!message) return null;
	const m = message.toLowerCase();

	// Infrastructure first — these strings are written by the worker's
	// reapers, and some of them also contain words the branches below match.
	if (
		m.startsWith('worker restarted') ||
		m.startsWith('worker shutdown') ||
		m.startsWith('stuck in queue') ||
		m.startsWith('stop timed out')
	) {
		return 'infrastructure';
	}

	if (m.startsWith('platform login failed') || m.startsWith('login failed')) {
		const reason = message.split('—').slice(1).join('—').trim().toLowerCase();
		if (!reason) return 'auth_unknown';
		if (reason.startsWith('automation error during login')) return 'automation_error';
		if (isCredentialReason(reason)) return 'auth_credentials';
		if (
			reason.startsWith('security-question') ||
			reason.startsWith('email verification required') ||
			reason.startsWith('two-factor authentication') ||
			reason.startsWith('phone/sms verification')
		) {
			return 'auth_verification';
		}
		if (reason.startsWith('captcha or human verification')) return 'auth_captcha';
		if (reason.startsWith('account restricted')) return 'auth_restricted';
		if (reason.startsWith('terms of service')) return 'auth_terms';
		return 'auth_unknown';
	}

	if (m.startsWith('could not connect to platform')) return 'platform_unreachable';
	if (m.startsWith('local browser disconnected')) return 'browser_disconnected';
	if (m.startsWith('platform access denied')) return 'access_denied';
	if (m.startsWith('could not fill the search form')) return 'interaction_failed';
	if (m.startsWith('request timed out')) return 'timeout';
	if (m.startsWith('ai service')) return 'llm_unavailable';
	// Assertion failures out of Patchright/CDP were written before the live
	// classifier had a branch for them, so they landed under the generic
	// message. Recovered here as tooling errors, which is what they are.
	if (m.includes('assertion error')) return 'automation_error';
	if (m.startsWith('an unexpected error occurred')) return 'unknown';
	return null;
}
