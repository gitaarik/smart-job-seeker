/**
 * Import-task readiness — the single source of truth for "can this import task
 * actually run?".
 *
 * Auto-import generates tasks the moment a profile is created, but a freshly
 * generated task often can't run yet: it may need a connected browser device,
 * login credentials for a gated platform, or the right login mode. This module
 * computes the unmet requirements ("blockers") from plain task + platform data
 * so the run endpoint can refuse to start, and the UI can tell the user exactly
 * what to fix.
 *
 * Pure and dependency-free on purpose: the same function runs server-side (the
 * authoritative gate in the run endpoint) and client-side (the detail-page
 * banner + overview-list badge), guaranteeing the UI never disagrees with what
 * the server enforces.
 */

export type ImportTaskBlockerKey = 'platform' | 'search_url' | 'device' | 'credentials';

export interface ImportTaskBlocker {
	key: ImportTaskBlockerKey;
	/** Short label for the icon tooltip / list heading. */
	title: string;
	/** One sentence: what's wrong and how to fix it. */
	detail: string;
}

export interface ImportTaskReadinessInput {
	platformId: number | null;
	/** Platform display name, for a friendlier credentials message. */
	platformName?: string | null;
	/** The task's own pre-built search URL, if any (`search_tasks.search_url`). */
	taskSearchUrl: string | null;
	/** The platform's configured search entry page (`job_platforms.search_page_url`). */
	platformSearchPageUrl: string | null;
	/**
	 * The platform's base URL (`job_platforms.url`). Last-resort navigation
	 * target for curated-listing sites (SvelteJobs, X-Team) whose landing page
	 * *is* the job list, so there is no separate search entry page to configure.
	 * Optional so existing callers that predate the fallback still type-check.
	 */
	platformUrl?: string | null;
	/** The platform's login page (`job_platforms.login_page_url`); null ⇒ public. */
	platformLoginPageUrl: string | null;
	/** `search_tasks.login_mode`: "auto" | "manual" | "none". */
	loginMode: string | null;
	/** Whether a credential is linked (`platform_profile_id` / credential id set). */
	hasCredential: boolean;
	/** `search_tasks.browser_provider`; null ⇒ use the server default. */
	browserProvider: string | null;
	/** Server default provider (`config.browserProvider`), for the null case. */
	serverBrowserProvider: string;
	/**
	 * Whether a usable browser device is connected for this task. Only consulted
	 * when the effective provider needs one (tunnel). Callers resolve this from
	 * live tunnel status (the task's pinned device, or the user's preferred one).
	 */
	deviceConnected: boolean;
}

/**
 * Browser providers a *task* may name. `null` means "use the server default".
 *
 * "goLogin" is deliberately absent: it is a server-config value that
 * getBrowserProvider() maps "hosted" onto, not something a task should set.
 * Keeping the task-level vocabulary to what the UI offers means an unknown
 * string is a bug or tampering, and either way should not reach the column.
 */
export const TASK_BROWSER_PROVIDERS = ['local', 'hosted', 'tunnel'] as const;
export type TaskBrowserProvider = (typeof TASK_BROWSER_PROVIDERS)[number];

export function isTaskBrowserProvider(value: unknown): value is TaskBrowserProvider {
	return typeof value === 'string' && (TASK_BROWSER_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Does the effective browser provider require the user to supply their own
 * connected device? Only the tunnel (desktop / self-hosted) provider does;
 * "local" and the cloud providers ("hosted"/"goLogin") run server-side.
 */
export function providerRequiresDevice(
	browserProvider: string | null,
	serverBrowserProvider: string
): boolean {
	const effective = browserProvider || serverBrowserProvider;
	return effective === 'tunnel';
}

/**
 * The unmet requirements that prevent this task from running, in fix-priority
 * order. Empty array ⇒ the task is runnable.
 */
export function computeImportTaskBlockers(input: ImportTaskReadinessInput): ImportTaskBlocker[] {
	const blockers: ImportTaskBlocker[] = [];

	if (!input.platformId) {
		blockers.push({
			key: 'platform',
			title: 'No platform selected',
			detail: 'Choose the job platform this import should scrape.'
		});
		// Without a platform the other checks have nothing to reason about.
		return blockers;
	}

	// Same precedence the worker and the run endpoint use to pick a starting
	// page. Keep the three in step: a task the UI calls runnable but the worker
	// then skips is worse than a task that never offered to run.
	const effectiveSearchUrl =
		input.taskSearchUrl || input.platformSearchPageUrl || input.platformUrl;
	if (!effectiveSearchUrl) {
		blockers.push({
			key: 'search_url',
			title: 'No search URL',
			detail:
				'This platform has no search page configured and the task has no search URL, so the scraper has nowhere to start.'
		});
	}

	if (
		providerRequiresDevice(input.browserProvider, input.serverBrowserProvider) &&
		!input.deviceConnected
	) {
		blockers.push({
			key: 'device',
			title: 'No browser device connected',
			detail:
				'This import runs on your own browser. Connect the desktop app or a self-hosted device, then pick it for this task.'
		});
	}

	// A gated platform (has a login page) needs credentials only when the task
	// auto-logs in. "manual" lets the user sign in live during the run, and
	// "none" skips login entirely — neither needs stored credentials.
	const needsLogin = !!input.platformLoginPageUrl;
	if (needsLogin && input.loginMode === 'auto' && !input.hasCredential) {
		const name = input.platformName?.trim() || 'This platform';
		blockers.push({
			key: 'credentials',
			title: 'Login credentials required',
			detail: `${name} requires you to sign in, but no credentials are set. Add a login, or switch the login mode to Manual to sign in yourself during the run.`
		});
	}

	return blockers;
}

/** Convenience: true when the task has no unmet requirements. */
export function isImportTaskRunnable(input: ImportTaskReadinessInput): boolean {
	return computeImportTaskBlockers(input).length === 0;
}
