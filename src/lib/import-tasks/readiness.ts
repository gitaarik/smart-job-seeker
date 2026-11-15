/**
 * Import-task readiness — the single source of truth for "can this import task
 * actually run?".
 *
 * Auto-import generates tasks the moment a profile is created, but a freshly
 * generated task often can't run yet: it may need a connected browser device,
 * or a platform and a search page to run against. This module
 * computes the unmet requirements ("blockers") from plain task + platform data
 * so the run endpoint can refuse to start, and the UI can tell the user exactly
 * what to fix.
 *
 * Pure and dependency-free on purpose: the same function runs server-side (the
 * authoritative gate in the run endpoint) and client-side (the detail-page
 * banner + overview-list badge), guaranteeing the UI never disagrees with what
 * the server enforces.
 */

import { PLATFORM_PAUSED } from '../job-platforms/taxonomy';

export type ImportTaskBlockerKey = 'platform' | 'paused' | 'search_url' | 'device';

export interface ImportTaskBlocker {
	key: ImportTaskBlockerKey;
	/** Short label for the icon tooltip / list heading. */
	title: string;
	/** One sentence: what's wrong and how to fix it. */
	detail: string;
}

export interface ImportTaskReadinessInput {
	platformId: number | null;
	/** Platform display name, for friendlier messages. */
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
	/**
	 * The platform's login page (`job_platforms.login_page_url`); null ⇒ public.
	 * Not a blocker on its own: a gated platform is signed in to by the user,
	 * in the browser, and the run stops to ask when the session has lapsed.
	 * Kept on the input because the UI's sign-in section reads it.
	 */
	platformLoginPageUrl: string | null;
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
	/**
	 * `job_platforms.fetch_mode`. A `feed` platform's run queries the ATS corpus
	 * on the worker (planning/ATS-FEEDS.md): no browser, no device, no sign-in,
	 * so none of those blockers apply to it.
	 */
	fetchMode?: string | null;
	/**
	 * `job_platforms.status`. `paused` is a board we have stopped reading, so
	 * none of its tasks run (`$lib/job-platforms/taxonomy`).
	 */
	platformStatus?: string | null;
}

/**
 * Browser providers a *task* may name. `null` means "use the server default".
 *
 * Keeping the task-level vocabulary to what the UI offers means an unknown
 * string is a bug or tampering, and either way should not reach the column.
 * "local" is the dev Docker Chrome and is further gated by
 * SJS_LOCAL_BROWSER_ALLOWED wherever a task is written.
 */
export const TASK_BROWSER_PROVIDERS = ['local', 'tunnel'] as const;
export type TaskBrowserProvider = (typeof TASK_BROWSER_PROVIDERS)[number];

export function isTaskBrowserProvider(value: unknown): value is TaskBrowserProvider {
	return typeof value === 'string' && (TASK_BROWSER_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Does the effective browser provider require the user to supply their own
 * connected device? Only the tunnel (desktop / self-hosted) provider does;
 * "local" runs server-side.
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

	if (input.platformStatus === PLATFORM_PAUSED) {
		blockers.push({
			key: 'paused',
			title: 'Platform paused',
			detail: `${input.platformName || 'This platform'} is paused: Smart Job Seeker no longer searches it. Choose another platform for this import.`
		});
		// Nothing else about the task matters while the platform is off.
		return blockers;
	}

	// Same precedence the worker and the run endpoint use to pick a starting
	// page. Keep the three in step: a task the UI calls runnable but the worker
	// then skips is worse than a task that never offered to run.
	if (input.fetchMode === 'feed') return blockers;

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

	// Signing in is never a blocker. A gated platform used to need a saved
	// login when the task signed in automatically; the server holds no
	// platform passwords any more (2026-11-14), so the user signs in once in
	// the browser and a run whose session has lapsed stops to ask (attended)
	// or fails with an auth tag that the auth-block policy notifies on.
	//
	// Also deliberately *not* a blocker: a task set to sign in on a platform
	// with no `login_page_url`. That combination does nothing at run time
	// (`handleLoginPhase` returns immediately), but `login_mode` defaults to
	// signing in at the column level, so every task ever created on a public
	// board carries it. The sign-in section says so where the setting is
	// edited instead — see `explainMissingSignInPage` in `sign-in.ts`.

	return blockers;
}

/** Convenience: true when the task has no unmet requirements. */
export function isImportTaskRunnable(input: ImportTaskReadinessInput): boolean {
	return computeImportTaskBlockers(input).length === 0;
}
