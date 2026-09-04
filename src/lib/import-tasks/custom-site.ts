/**
 * Policy for the "Other site" branch of the add-task form: what the task does
 * with the URL the user pasted.
 *
 * Kept pure and separate for the same reason as `readiness.ts` — the rule is
 * small, the consequences of getting it wrong are silent, and the only way to
 * see it is a run nobody is watching.
 *
 * The rule exists because two fields that look independent are not.
 * `configureSearchViaForm` (cloud `src/server/scrapers/scraper.ts`) treats a
 * task-level `search_url` as an explicit instruction and skips the search form
 * entirely when one is set. So a task carrying both a URL and keywords runs
 * with the keywords dropped: the whole board harvested, reported as a success.
 * Deciding it at save time is what turns that into a sentence the user reads.
 */

/**
 * Column limits on `job_platforms`. `search_tasks.search_url` is `text`, so
 * only the platform-side copies are bounded, which is why an over-long search
 * URL can still be imported as-is but cannot become a search page.
 */
export const SEARCH_PAGE_URL_MAX = 512;
export const LOGIN_PAGE_URL_MAX = 255;

/**
 * Stand-in platform id for "a site we don't have yet", used by the add form's
 * picker before any platform row exists. Negative so it can never collide with
 * a real serial id, and shared so the picker and the form cannot drift.
 */
export const CUSTOM_PLATFORM_ID = -1;

export interface CustomSiteSearchInput {
	/** True when the user used the "Other site" branch rather than the dropdown. */
	platformIsNew: boolean;
	/** The URL the user pasted, already trimmed. Null when they picked a site. */
	pastedUrl: string | null;
	/**
	 * The resolved platform's search entry page, after `getOrCreatePlatform`
	 * has filled in anything it was allowed to fill. Equal to `pastedUrl` when
	 * the pasted URL became this platform's search page.
	 */
	platformSearchPageUrl: string | null;
	/** Resolved platform display name, so a refusal can name the site. */
	platformName: string;
	/** Keywords the user typed, already trimmed. */
	searchTerm: string | null;
}

export type CustomSiteSearchResult =
	{ ok: true; searchUrl: string | null } | { ok: false; error: string };

/**
 * Decide the task's own `search_url`.
 *
 * Null means the task defers to the platform's search page, which is what lets
 * the scraper drive that page's search form. A string means direct navigation
 * to exactly that URL, with no form driven and therefore no keywords.
 */
export function resolveCustomSiteSearchUrl(input: CustomSiteSearchInput): CustomSiteSearchResult {
	const { platformIsNew, pastedUrl, platformSearchPageUrl, platformName, searchTerm } = input;

	// Not the custom branch, or nothing pasted: whatever came in stands.
	if (!platformIsNew || !pastedUrl) return { ok: true, searchUrl: pastedUrl };

	// The pasted URL became the platform's search page, so the task has nothing
	// left to override. Holding no URL of its own is what lets the form flow run.
	if (platformSearchPageUrl === pastedUrl) return { ok: true, searchUrl: null };

	// It did not, so the URL stays on the task and no form will be driven.
	// Without keywords that is exactly right: go to the page and import it.
	if (!searchTerm) return { ok: true, searchUrl: pastedUrl };

	// With keywords it is not, and the two reasons need different advice.
	if (pastedUrl.length > SEARCH_PAGE_URL_MAX) {
		return {
			ok: false,
			error:
				`That job search URL is too long to search with keywords (over ${SEARCH_PAGE_URL_MAX} ` +
				`characters). Clear the keywords to import it exactly as it is, or paste a shorter URL ` +
				`for the site's search page.`
		};
	}
	return {
		ok: false,
		error:
			`We already know ${platformName}, so its search page is the one we have on file rather than ` +
			`the URL you pasted. Pick ${platformName} from the Site list to search it with keywords, or ` +
			`clear the keywords to import your URL exactly as it is.`
	};
}
