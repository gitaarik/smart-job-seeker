import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { and, asc, desc, eq, inArray, isNotNull, or } from 'drizzle-orm';
import {
	api_keys,
	job_platforms,
	platform_credentials,
	platform_profiles,
	profiles,
	search_tasks
} from '$lib/server/db/schema';
import { config } from '$lib/server/config';
import { encryptCredential } from '$lib/server/auth/crypto';
import { hasCredentialAccess } from '$lib/server/credential-shares';
import { listApiKeys } from '$lib/server/auth/api-key';
import { hasDeviceAccess, listSharedWithMe } from '$lib/server/device-shares';
import { getSelectedProfileId } from '../../../profile/utils';
import { checkPublicHttpUrl } from '$lib/server/net/public-url';
import { isTaskBrowserProvider } from '$lib/import-tasks/readiness';
import {
	LOGIN_PAGE_URL_MAX,
	SEARCH_PAGE_URL_MAX,
	resolveCustomSiteSearchUrl
} from '$lib/import-tasks/custom-site';

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const profileId = layoutData.selectedProfile.id;
	const user = layoutData.user;

	const [searchTasksList, profile] = await Promise.all([
		db.query.search_tasks.findMany({
			where: eq(search_tasks.profile_id, profileId),
			with: {
				job_platform: true,
				platform_profile: true
			},
			orderBy: desc(search_tasks.date_created)
		}),
		(async () => {
			const p = await db.query.profiles.findFirst({
				where: eq(profiles.id, profileId),
				columns: {
					ui_preferences: true,
					browser_country_code: true,
					country_code: true
				}
			});
			if (!p) throw new Error('Record not found');
			return p;
		})()
	]);
	const searchTasks = searchTasksList;

	const uiPrefs = (profile.ui_preferences as Record<string, unknown>) ?? {};

	// Devices for the new-task browser-control picker: own keys + devices a
	// contact has shared with this user. Mirrors the edit page so the add form
	// shows shared devices too. owner_user_id is null for own devices and the
	// device-owner's user id for shared devices, used to enforce the
	// credential/device-owner coupling at create time.
	interface DeviceOption {
		apiKeyId: number;
		apiKeyName: string;
		shared: boolean;
		owner_user_id: string | null;
	}
	const allApiKeys = await listApiKeys(user.id);
	const apiKeyDevices: DeviceOption[] = allApiKeys
		.filter((k) => !k.revoked)
		.map((k) => ({
			apiKeyId: k.id,
			apiKeyName: k.name,
			shared: false,
			owner_user_id: null
		}));
	if (user) {
		const sharedDevices = await listSharedWithMe(user.id);
		for (const share of sharedDevices) {
			const ownerName = share.api_key.owner?.name || share.api_key.owner?.email || 'Unknown';
			apiKeyDevices.push({
				apiKeyId: share.api_key.id,
				apiKeyName: `${share.api_key.name} (${ownerName})`,
				shared: true,
				owner_user_id: share.api_key.owner?.id ?? null
			});
		}
	}

	// Platforms the add-task form will offer.
	//
	// `search_page_url` used to be required here, on the assumption that every
	// import drives a search form. Curated-listing sites don't have one — their
	// landing page *is* the job list — and the requirement silently hid 12 of
	// the 26 published platforms, SvelteJobs among them, even though the form's
	// own help text names it as the example of a leave-keywords-empty site. The
	// scraper falls back to `url` for exactly this case, so the form can too.
	//
	// Plus the user's own custom sites, by ownership rather than by inference.
	// `created_by_user_id` is the authority; the third clause only keeps a
	// platform visible when one of this profile's existing tasks already points
	// at it, so a task created before the column existed does not lose its entry
	// in the dropdown.
	const ownPlatformIds = await db
		.selectDistinct({ id: search_tasks.platform_id })
		.from(search_tasks)
		.where(and(eq(search_tasks.profile_id, profileId), isNotNull(search_tasks.platform_id)));
	const ownIds = ownPlatformIds.map((r) => r.id).filter((id): id is number => id !== null);

	const importablePlatforms = await db
		.select({
			id: job_platforms.id,
			key: job_platforms.key,
			name: job_platforms.name,
			url: job_platforms.url,
			search_page_url: job_platforms.search_page_url,
			// Whether the site asks for a sign-in. The add form used to pin every
			// platform picked here to login_mode "none", which on a gated site
			// produces a task that can never log in and never says so; it now
			// derives the mode from this column instead.
			login_page_url: job_platforms.login_page_url
		})
		.from(job_platforms)
		.where(
			or(
				eq(job_platforms.status, 'published'),
				eq(job_platforms.created_by_user_id, user.id),
				ownIds.length > 0 ? inArray(job_platforms.id, ownIds) : undefined
			)
		)
		.orderBy(asc(job_platforms.id));

	return {
		searchTasks,
		profileId,
		searchTaskSort: (uiPrefs.searchTaskSort as string) ?? 'added',
		localBrowserAllowed: config.localBrowserAllowed,
		serverBrowserProvider: config.browserProvider,
		defaultBrowserProvider: config.defaultBrowserProvider,
		defaultMaxJobs: config.defaultMaxJobs,
		browserCountryCode: profile.browser_country_code ?? '',
		defaultCountryCode: profile.country_code ?? '',
		apiKeyDevices,
		importablePlatforms
	};
};

interface ResolvedPlatform {
	id: number;
	/** Display name, so a refusal can say which site it means. */
	name: string;
	/**
	 * The platform's search entry page after any fill-in below. The caller
	 * compares it against the URL the user pasted to decide whether the task
	 * still needs a `search_url` of its own.
	 */
	searchPageUrl: string | null;
}

async function getOrCreatePlatform(
	platformId: string | null,
	platformUrl: string | null,
	platformName: string | null,
	isNew: boolean,
	loginPageUrl: string | null = null,
	createdByUserId: string | null = null,
	searchPageUrl: string | null = null
): Promise<ResolvedPlatform | null> {
	// Fast path: existing platform_id, no creation needed (AI suggestions hit
	// this — they pass platform_id directly without a URL).
	if (platformId && !isNew) {
		const id = parseInt(platformId);
		const row = await db.query.job_platforms.findFirst({
			where: eq(job_platforms.id, id),
			columns: {
				id: true,
				name: true,
				search_page_url: true,
				login_page_url: true,
				created_by_user_id: true
			}
		});
		if (!row) return null;
		// Same fill-gaps-on-your-own-row rule the create branch below applies,
		// and for the same reason: `job_platforms` is shared. This used to write
		// whatever the form sent, unconditionally — and because an absent field
		// arrives as an empty string rather than null, a form that rendered the
		// input and left it blank would *clear* LinkedIn's sign-in page for every
		// account on the instance. Nothing in the UI sends it on this path any
		// more, so this is the belt to that braces: the action is a POST anyone
		// authenticated can shape.
		const ownsRow = createdByUserId !== null && row.created_by_user_id === createdByUserId;
		if (ownsRow && !row.login_page_url && loginPageUrl) {
			await db
				.update(job_platforms)
				.set({ login_page_url: loginPageUrl })
				.where(eq(job_platforms.id, id));
		}
		return { id: row.id, name: row.name, searchPageUrl: row.search_page_url };
	}

	if (!platformUrl) return null;

	const domain = hostKey(platformUrl);
	if (!domain) return null;

	// Match on the host, exactly. This used to be
	// `url LIKE '%domain%' OR key LIKE '%first-label%'`, which binds a custom
	// site to any unrelated platform that happens to share a substring: a URL
	// on `jobs.acme.com` matches every existing row whose key contains "jobs".
	// Binding to the wrong platform is not cosmetic — the task inherits that
	// platform's login page and credential requirements. The table is small and
	// admin-curated, so comparing parsed hosts in JS beats an approximation in
	// SQL.
	const candidates = await db
		.select({
			id: job_platforms.id,
			name: job_platforms.name,
			url: job_platforms.url,
			search_page_url: job_platforms.search_page_url,
			login_page_url: job_platforms.login_page_url,
			created_by_user_id: job_platforms.created_by_user_id
		})
		.from(job_platforms);
	const existing = candidates.find((p) => hostKey(p.url) === domain);
	if (existing) {
		// The row is shared, so what the user typed only fills gaps, and only on
		// a row they own. Writing their search page onto a published platform
		// would redirect every other user's tasks on that site; overwriting a
		// value that is already there would do the same to their own earlier
		// setup. Filling an empty column on your own draft is neither.
		//
		// This branch used to `return existing.id` outright, which silently
		// dropped the login URL the user had just typed — the create path a few
		// lines down stored it, so whether it survived depended on nothing the
		// user could see.
		const isOwn = createdByUserId !== null && existing.created_by_user_id === createdByUserId;
		const fill: Partial<{ search_page_url: string; login_page_url: string }> = {};
		if (isOwn && !existing.search_page_url && searchPageUrl) {
			fill.search_page_url = searchPageUrl;
		}
		if (isOwn && !existing.login_page_url && loginPageUrl) {
			fill.login_page_url = loginPageUrl;
		}
		if (Object.keys(fill).length > 0) {
			await db.update(job_platforms).set(fill).where(eq(job_platforms.id, existing.id));
		}
		return {
			id: existing.id,
			name: existing.name,
			searchPageUrl: fill.search_page_url ?? existing.search_page_url
		};
	}

	// Create new platform
	const key = domain
		.replace(/\.[^.]+$/, '')
		.replace(/[^a-z0-9]/gi, '-')
		.toLowerCase();

	const [platform] = await db
		.insert(job_platforms)
		.values({
			name: platformName || domain,
			url: platformUrl,
			key: `${key}-${Date.now().toString(36)}`, // Ensure unique key
			login_page_url: loginPageUrl || null,
			// The page the scraper drives the search form on. Setting it here is
			// what lets a user-added site take keywords at all: with it empty,
			// configureSearchViaForm has nowhere to type and the task can only
			// navigate to a fixed URL.
			search_page_url: searchPageUrl || null,
			// Ownership, so the dropdown can ask "published OR mine" directly
			// rather than inferring it from which platforms a profile's tasks
			// happen to reference.
			created_by_user_id: createdByUserId,
			// `draft`, not `published`: this row is global and unvetted. Draft
			// keeps it out of the curated list that every other user sees, and
			// leaves "promote to published" as an admin decision once a site
			// proves itself.
			status: 'draft',
			date_created: new Date()
		})
		.returning();

	return {
		id: platform.id,
		name: platform.name,
		searchPageUrl: platform.search_page_url
	};
}

/**
 * Normalised host for platform identity: lowercased, `www.` stripped.
 * Returns null when the input isn't a parseable absolute URL — callers treat
 * that as "no platform", which beats throwing a 500 out of a form action.
 */
function hostKey(rawUrl: string | null): string | null {
	if (!rawUrl) return null;
	try {
		return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
	} catch {
		return null;
	}
}

/**
 * Resolve the per-profile runtime row that backs `search_tasks.platform_profile_id`.
 *
 * The picker speaks in `platform_credentials.id` (user-wide); the search
 * task still references a `platform_profiles` row so each profile keeps
 * its own login state (`status`, `last_login_at`, `login_error`) for the
 * same shared credential. This helper resolves or creates that binding.
 *
 * - `credentialId === "new"`: insert into platform_credentials.
 * - `credentialId` numeric: validate via hasCredentialAccess (owner or
 *   share recipient), then find-or-create the platform_profiles row.
 * - "none" / null / unparseable: return null (task saves with no cred).
 */
async function getOrCreateCredentials(
	profileId: number,
	platformId: number,
	userId: string,
	credentialId: string | null,
	newUsername: string | null,
	newPassword: string | null,
	newSecurityAnswer: string | null = null
): Promise<number | null> {
	let credId: number | null = null;

	if (credentialId && credentialId !== 'none' && credentialId !== 'new') {
		const credIdNum = parseInt(credentialId);
		if (isNaN(credIdNum)) return null;
		if (!(await hasCredentialAccess(credIdNum, userId))) return null;
		// Sanity-check the platform matches; the picker shouldn't offer a
		// credential for the wrong platform but defend anyway.
		const cred = await db.query.platform_credentials.findFirst({
			where: and(
				eq(platform_credentials.id, credIdNum),
				eq(platform_credentials.platform_id, platformId)
			),
			columns: { id: true }
		});
		if (!cred) return null;
		credId = cred.id;
	}

	if (credentialId === 'new' && newUsername) {
		const [created] = await db
			.insert(platform_credentials)
			.values({
				user_id: userId,
				platform_id: platformId,
				username: newUsername,
				password: encryptCredential(newPassword || null),
				security_answer: encryptCredential(newSecurityAnswer || null),
				date_created: new Date(),
				date_updated: new Date()
			})
			.returning({ id: platform_credentials.id });
		credId = created.id;
	}

	if (credId === null) return null;

	// Per-profile runtime row: one row per (profile, credential). Reused on
	// subsequent task creations so login_error / last_login_at accumulate
	// against a stable identity rather than spawning duplicate rows.
	const existingPp = await db.query.platform_profiles.findFirst({
		where: and(
			eq(platform_profiles.profile_id, profileId),
			eq(platform_profiles.platform_credential_id, credId)
		),
		columns: { id: true }
	});
	if (existingPp) return existingPp.id;

	const [newPp] = await db
		.insert(platform_profiles)
		.values({
			profile_id: profileId,
			platform_id: platformId,
			platform_credential_id: credId,
			status: 'active',
			date_created: new Date()
		})
		.returning({ id: platform_profiles.id });
	return newPp.id;
}

export const actions: Actions = {
	create: async ({ request, locals, cookies }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) {
			return fail(400, { error: 'No profile selected' });
		}

		const formData = await request.formData();
		const note = formData.get('note') as string;
		const search_url = formData.get('search_url') as string;
		const search_term = formData.get('search_term') as string;
		const search_location = formData.get('search_location') as string;
		const search_filters_raw = formData.get('search_filters') as string;
		let search_filters: Record<string, string | string[]> = {};
		if (search_filters_raw) {
			try {
				const parsed = JSON.parse(search_filters_raw);
				if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
					search_filters = Object.fromEntries(
						Object.entries(parsed).filter(([k, v]) => {
							if (typeof k !== 'string') return false;
							if (typeof v === 'string') return true;
							if (Array.isArray(v)) {
								return v.every((x) => typeof x === 'string');
							}
							return false;
						}) as [string, string | string[]][]
					);
				}
			} catch {
				// Malformed filter JSON — silently drop. The form always sends
				// valid JSON; bad input here means a client bug or tampering.
			}
		}
		const is_active = formData.get('is_active') !== 'false';

		// Platform data
		const platformId = formData.get('platform_id') as string;
		const platformUrl = formData.get('platform_url') as string;
		const platformName = formData.get('platform_name') as string;
		const platformIsNew = formData.get('platform_is_new') === 'true';
		const loginPageUrl = formData.get('login_page_url') as string;

		// Credentials data
		const credentialId = formData.get('credential_id') as string;
		const newCredUsername = formData.get('new_credential_username') as string;
		const newCredPassword = formData.get('new_credential_password') as string;
		const newCredSecurityAnswer = formData.get('new_credential_security_answer') as string;

		// search_term is OPTIONAL — listing-only platforms (SvelteJobs, X-Team)
		// have no search input to fill, so we just navigate and extract. The
		// scraper checks for keywords/filters at run time and skips form-fill
		// when there's nothing to apply.

		// Both of these end up as a navigation target for a real browser, so
		// neither may point inside our own network. See public-url.ts.
		for (const [label, candidate] of [
			['site address', platformUrl],
			['search URL', search_url],
			['login page URL', loginPageUrl]
		] as const) {
			if (!candidate?.trim()) continue;
			const verdict = checkPublicHttpUrl(candidate);
			if (!verdict.ok) {
				return fail(400, { error: `That ${label} can't be used: ${verdict.reason}` });
			}
		}

		// `job_platforms.login_page_url` is varchar(255) and there is nowhere
		// else to put it, so an over-long one is a refusal rather than a 500 on
		// insert. The search URL has somewhere to fall back to (see below), so
		// its length is handled there instead.
		if (loginPageUrl?.trim() && loginPageUrl.trim().length > LOGIN_PAGE_URL_MAX) {
			return fail(400, {
				error: `That login page URL is too long (over ${LOGIN_PAGE_URL_MAX} characters).`
			});
		}

		// Get or create platform
		// The custom-site branch treats the pasted URL as the site's search page,
		// so a brand-new platform gets it as `search_page_url` and the keyword
		// box has somewhere to type. Nothing is passed for a platform picked
		// from the dropdown: its search page is already curated.
		//
		// `search_page_url` is varchar(512) while `search_tasks.search_url` is
		// text, so a URL past that length can only live on the task. Passing it
		// anyway would fail the insert; withholding it leaves the platform
		// without a search page and the task keeps the URL, which is what the
		// custom branch did before keywords were an option.
		const pastedSearchUrl = search_url?.trim() || null;
		const searchPageUrl =
			platformIsNew && pastedSearchUrl && pastedSearchUrl.length <= SEARCH_PAGE_URL_MAX
				? pastedSearchUrl
				: null;
		const resolvedPlatform = await getOrCreatePlatform(
			platformId,
			platformUrl,
			platformName,
			platformIsNew,
			loginPageUrl,
			user.id,
			searchPageUrl
		);
		const resolvedPlatformId = resolvedPlatform?.id ?? null;

		// A custom site that resolved to nothing means the URL wasn't parseable.
		// getOrCreatePlatform answers null for that, and a task with no platform
		// can never run (the scraper loads the platform row by id, and the run
		// endpoint refuses without one), so refuse here rather than hand back a
		// task that looks saved and is permanently stuck.
		if (platformUrl && !resolvedPlatformId) {
			return fail(400, { error: `Could not read a site address from "${platformUrl}".` });
		}
		// Same reasoning for a platform_id that no longer resolves to a row —
		// deleted between page load and submit, or tampered with. Storing it
		// would violate the foreign key; storing null would be the stuck task.
		if (platformId && !resolvedPlatformId) {
			return fail(400, { error: 'That site is no longer available. Pick another one.' });
		}

		// Whether the task keeps a `search_url` of its own — see custom-site.ts
		// for why a URL and keywords cannot both stand.
		const searchUrlDecision = resolveCustomSiteSearchUrl({
			platformIsNew,
			pastedUrl: pastedSearchUrl,
			platformSearchPageUrl: resolvedPlatform?.searchPageUrl ?? null,
			platformName: resolvedPlatform?.name ?? 'that site',
			searchTerm: search_term?.trim() || null
		});
		if (!searchUrlDecision.ok) {
			return fail(400, { error: searchUrlDecision.error });
		}
		const resolvedSearchUrl = searchUrlDecision.searchUrl;

		// Get or create credentials
		let resolvedCredentialId: number | null = null;
		if (resolvedPlatformId) {
			resolvedCredentialId = await getOrCreateCredentials(
				profileId,
				resolvedPlatformId,
				user.id,
				credentialId,
				newCredUsername,
				newCredPassword,
				newCredSecurityAnswer
			);
		}

		// Login mode
		const loginMode = formData.get('login_mode') as string;

		// Scraping options
		const browserProvider = formData.get('browser_provider') as string;
		// Same allowlist the PATCH endpoint applies: an unknown provider string
		// reaches getBrowserProvider() as an override and silently becomes the
		// local Chrome container, and "local" itself must respect
		// SJS_LOCAL_BROWSER_ALLOWED rather than only being hidden from the picker.
		if (browserProvider) {
			if (!isTaskBrowserProvider(browserProvider)) {
				return fail(400, { error: `Unknown browser provider "${browserProvider}".` });
			}
			if (browserProvider === 'local' && !config.localBrowserAllowed) {
				return fail(400, { error: 'The local browser is not available on this server.' });
			}
		}
		const sjsBrowserApiKeyRaw = formData.get('sjsbrowser_api_key') as string;
		const maxJobsRaw = formData.get('max_jobs') as string;
		const skipFirstRaw = formData.get('skip_first') as string;
		const stopAfterDuplicatesRaw = formData.get('stop_after_duplicates') as string;
		const skipExistingRaw = formData.get('skip_existing') as string;
		const keepMinimizedRaw = formData.get('keep_minimized') as string;

		const maxJobs = maxJobsRaw ? parseInt(maxJobsRaw) : null;
		const skipFirst = skipFirstRaw ? parseInt(skipFirstRaw) : null;
		const stopAfterDuplicates = stopAfterDuplicatesRaw ? parseInt(stopAfterDuplicatesRaw) : null;
		const skipExisting = skipExistingRaw === 'true';
		const keepMinimized = keepMinimizedRaw === 'false' ? false : true;

		// Resolve and validate tunnel device picked at create time. The user can
		// pick one of their own devices or one a contact has shared with them.
		// When paired with a shared credential the device must be owned by that
		// credential's owner — same coupling rule the PATCH endpoint enforces.
		// Silently drop on mismatch; the user can re-pick on the detail page.
		let resolvedSjsBrowserApiKey: number | null = null;
		const apiKeyId = sjsBrowserApiKeyRaw ? parseInt(sjsBrowserApiKeyRaw) : NaN;
		if (!isNaN(apiKeyId) && (await hasDeviceAccess(apiKeyId, user.id))) {
			let credOwner: string | null = null;
			if (resolvedCredentialId !== null) {
				const pp = await db.query.platform_profiles.findFirst({
					where: eq(platform_profiles.id, resolvedCredentialId),
					columns: { id: true },
					with: {
						platform_credential: { columns: { user_id: true } }
					}
				});
				credOwner = pp?.platform_credential?.user_id ?? null;
			}
			const credIsShared = credOwner !== null && credOwner !== user.id;
			if (!credIsShared) {
				resolvedSjsBrowserApiKey = apiKeyId;
			} else {
				const key = await db.query.api_keys.findFirst({
					where: eq(api_keys.id, apiKeyId),
					columns: { id: true },
					with: { profile: { columns: { user_id: true } } }
				});
				if (key?.profile.user_id === credOwner) {
					resolvedSjsBrowserApiKey = apiKeyId;
				}
			}
		}

		// Browser location
		const browserCountryCode = formData.get('browser_country_code') as string;
		if (browserCountryCode) {
			await db
				.update(profiles)
				.set({
					browser_country_code: browserCountryCode.trim().toUpperCase() || null
				})
				.where(eq(profiles.id, profileId));
		}

		// The configured default is operator input rather than user input, so it
		// is not rejected the way the form field is — but a server that forbids
		// the local browser should not have its own default write "local" either,
		// which is the shape the two settings disagreed in: the create action
		// refused a user asking for local while still defaulting to it. Null is
		// the honest answer, deferring to whatever the server resolves at run
		// time (worker.ts / the run endpoint), which is also what the UI's
		// "Local" button sends.
		const defaultBrowserProvider =
			config.defaultBrowserProvider === 'local' && !config.localBrowserAllowed
				? null
				: config.defaultBrowserProvider;

		// Schedule
		const scheduleRaw = formData.get('schedule_interval_hours') as string;
		const scheduleIntervalHours = scheduleRaw ? parseInt(scheduleRaw) : null;

		const [newTask] = await db
			.insert(search_tasks)
			.values({
				note: note?.trim() || null,
				search_url: resolvedSearchUrl,
				search_term: search_term?.trim() || null,
				search_location: search_location?.trim() || null,
				search_filters,
				platform_id: resolvedPlatformId,
				platform_profile_id: resolvedCredentialId,
				login_mode: ['auto', 'manual', 'none'].includes(loginMode) ? loginMode : 'auto',
				is_active,
				profile_id: profileId,
				status: 'idle',
				browser_provider: browserProvider || defaultBrowserProvider,
				sjsbrowser_api_key: resolvedSjsBrowserApiKey,
				max_jobs: isNaN(maxJobs as number) ? null : maxJobs,
				skip_first: isNaN(skipFirst as number) ? null : skipFirst,
				stop_after_duplicates: isNaN(stopAfterDuplicates as number) ? null : stopAfterDuplicates,
				skip_existing: skipExisting,
				keep_minimized: keepMinimized,
				schedule_interval_hours:
					scheduleIntervalHours && !isNaN(scheduleIntervalHours) ? scheduleIntervalHours : null,
				next_scheduled_run:
					scheduleIntervalHours && !isNaN(scheduleIntervalHours)
						? new Date(Date.now() + scheduleIntervalHours * 3600_000)
						: null,
				date_created: new Date()
			})
			.returning();

		return { success: true, taskId: newTask.id };
	},

	update: async ({ request, locals, cookies }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) {
			return fail(400, { error: 'No profile selected' });
		}

		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const note = formData.get('note') as string;
		const search_url = formData.get('search_url') as string;
		const search_term = formData.get('search_term') as string;
		const is_active = formData.get('is_active') !== 'false';

		// Platform data
		const platformId = formData.get('platform_id') as string;
		const platformUrl = formData.get('platform_url') as string;
		const platformName = formData.get('platform_name') as string;
		const platformIsNew = formData.get('platform_is_new') === 'true';
		const loginPageUrl = formData.get('login_page_url') as string;

		// Credentials data
		const credentialId = formData.get('credential_id') as string;
		const newCredUsername = formData.get('new_credential_username') as string;
		const newCredPassword = formData.get('new_credential_password') as string;
		const newCredSecurityAnswer = formData.get('new_credential_security_answer') as string;

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid search ID' });
		}

		const existing = await db.query.search_tasks.findFirst({
			where: and(eq(search_tasks.id, id), eq(search_tasks.profile_id, profileId))
		});

		if (!existing) {
			return fail(404, { error: 'Job search not found' });
		}

		// Both of these end up as a navigation target for a real browser, so
		// neither may point inside our own network. See public-url.ts.
		for (const [label, candidate] of [
			['site address', platformUrl],
			['search URL', search_url],
			['login page URL', loginPageUrl]
		] as const) {
			if (!candidate?.trim()) continue;
			const verdict = checkPublicHttpUrl(candidate);
			if (!verdict.ok) {
				return fail(400, { error: `That ${label} can't be used: ${verdict.reason}` });
			}
		}

		// Get or create platform
		const resolvedPlatform = await getOrCreatePlatform(
			platformId,
			platformUrl,
			platformName,
			platformIsNew,
			loginPageUrl,
			user.id
		);
		const resolvedPlatformId = resolvedPlatform?.id ?? null;

		// A custom site that resolved to nothing means the URL wasn't parseable.
		// getOrCreatePlatform answers null for that, and a task with no platform
		// can never run (the scraper loads the platform row by id, and the run
		// endpoint refuses without one), so refuse here rather than hand back a
		// task that looks saved and is permanently stuck.
		if (platformUrl && !resolvedPlatformId) {
			return fail(400, { error: `Could not read a site address from "${platformUrl}".` });
		}
		// Same reasoning for a platform_id that no longer resolves to a row —
		// deleted between page load and submit, or tampered with. Storing it
		// would violate the foreign key; storing null would be the stuck task.
		if (platformId && !resolvedPlatformId) {
			return fail(400, { error: 'That site is no longer available. Pick another one.' });
		}

		// Get or create credentials
		let resolvedCredentialId: number | null = null;
		if (resolvedPlatformId) {
			resolvedCredentialId = await getOrCreateCredentials(
				profileId,
				resolvedPlatformId,
				user.id,
				credentialId,
				newCredUsername,
				newCredPassword,
				newCredSecurityAnswer
			);
		}

		await db
			.update(search_tasks)
			.set({
				note: note?.trim() || null,
				search_url: search_url?.trim() || null,
				search_term: search_term?.trim() || null,
				platform_id: resolvedPlatformId,
				platform_profile_id: resolvedCredentialId,
				is_active,
				date_updated: new Date()
			})
			.where(eq(search_tasks.id, id));

		return { success: true };
	},

	delete: async ({ request, locals, cookies }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) {
			return fail(400, { error: 'No profile selected' });
		}

		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid search ID' });
		}

		const existing = await db.query.search_tasks.findFirst({
			where: and(eq(search_tasks.id, id), eq(search_tasks.profile_id, profileId))
		});

		if (!existing) {
			return fail(404, { error: 'Job search not found' });
		}

		await db.delete(search_tasks).where(eq(search_tasks.id, id));

		return { success: true };
	}
};
