<script lang="ts">
	/**
	 * Add-task form for the new dynamic search-form flow. The user picks a
	 * platform and types search keywords; the scraper handles search-form
	 * configuration at run time using the platform's `search_page_url`.
	 *
	 * No URL templates, no preset picker, no live URL preview. The previous
	 * version (which wrapped SourcePicker) is gone with the URL-template
	 * system. Edit-task flow still uses the old machinery and will be
	 * migrated in a follow-up.
	 *
	 * The dropdown also carries an "Other site" option. Custom sites were never
	 * deliberately dropped — SourcePicker owned that UI and went out with the
	 * URL-template system it was built around, while the server action, the
	 * `search_tasks.search_url` column and the scraper's direct-navigation path
	 * all stayed. This re-exposes them: the user gives a job search URL, an
	 * optional login page, and optional keywords. Extraction is generic (AX
	 * tree + LLM identification, no per-site selectors), so an arbitrary site
	 * works without any platform-specific configuration.
	 *
	 * With keywords, the URL becomes the new platform's `search_page_url` and
	 * the scraper drives that page's own search form. Without them it is a
	 * plain navigation target, which is what someone pasting a search they
	 * already built in their browser wants.
	 */
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCloud, faLaptop } from '@fortawesome/free-solid-svg-icons';
	import { track } from '$lib/tools/analytics';
	import type { SearchFilterValue } from '$lib/job-platforms/search-filters';
	import FilterPicker from './FilterPicker.svelte';
	import PlatformCombobox from './PlatformCombobox.svelte';
	import { CUSTOM_PLATFORM_ID } from '$lib/import-tasks/custom-site';

	export type ImportablePlatform = {
		id: number;
		key: string;
		name: string;
		url: string;
		search_page_url: string | null;
	};

	/** The device a run would use, from `/api/tunnel/status/preferred`. */
	export type PreferredDevice = {
		apiKeyId: number;
		apiKeyName: string;
		isShared: boolean;
		ownerLabel: string | null;
	};

	interface Props {
		platforms: ImportablePlatform[];
		defaultMaxJobs: number | null;
		/**
		 * Connected device to pin the new task to, or null when none is
		 * connected. The parent already polls tunnel status for the overview
		 * badges, so this is passed down rather than fetched again.
		 */
		preferredDevice: PreferredDevice | null;
		/** False until the first tunnel-status fetch resolves. */
		deviceStatusChecked: boolean;
		onCancel: () => void;
	}

	let { platforms, defaultMaxJobs, preferredDevice, deviceStatusChecked, onCancel }: Props =
		$props();

	/**
	 * Nothing is selected until the user picks. The old `<select>` had to open
	 * on something, and "the first platform with a search page" meant Turing,
	 * which is a marketing homepage that has never returned a job on this
	 * instance — a default nobody chose and few would notice before submitting.
	 *
	 * A search field has no such obligation: empty is a prompt to type, and the
	 * submit button stays disabled until there is an answer.
	 */
	let platformId = $state<number | null>(null);
	let customUrl = $state('');
	let customName = $state('');
	let customLoginUrl = $state('');
	let keywords = $state('');
	let note = $state('');
	let filters = $state<Record<string, SearchFilterValue>>({});
	let submitting = $state(false);

	const isCustom = $derived(platformId === CUSTOM_PLATFORM_ID);
	const selectedPlatform = $derived(platforms.find((p) => p.id === platformId) ?? null);

	/**
	 * Carry what the user typed in the picker into the add-a-site fields, so
	 * searching for a board we don't have is the first step of adding it rather
	 * than a dead end they retype their way out of.
	 *
	 * Which field it lands in is decided by shape, not by asking. Anything with
	 * a dot and no spaces is a host, and a host is the one thing we can turn
	 * into a working URL on its own; everything else is a name. Both stay
	 * editable, and an existing value is never overwritten — the picker can be
	 * reopened after the URL is typed, and losing it to a second visit would be
	 * the kind of bug that only shows up when someone changes their mind.
	 */
	function adoptTypedSite(typed: string) {
		const q = typed.trim();
		if (!q) return;
		if (/^https?:\/\//i.test(q)) {
			if (!customUrl.trim()) customUrl = q;
			return;
		}
		if (/^[^\s/]+\.[^\s/]{2,}(\/\S*)?$/.test(q)) {
			if (!customUrl.trim()) customUrl = `https://${q}`;
			return;
		}
		if (!customName.trim()) customName = q;
	}

	/**
	 * Origin of the pasted URL, used as the platform's base URL. Also doubles as
	 * the validity check: `URL` throws on anything that isn't absolute, which is
	 * the mistake to catch here (a bare `example.com/jobs` would otherwise reach
	 * the server and resolve to no platform at all).
	 */
	const customOrigin = $derived.by(() => {
		const trimmed = customUrl.trim();
		if (!trimmed) return null;
		try {
			const parsed = new URL(trimmed);
			if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
			return parsed.origin;
		} catch {
			return null;
		}
	});

	const customUrlError = $derived(
		isCustom && customUrl.trim() && !customOrigin ? 'Enter a full URL including https://' : null
	);

	/** Same absolute-URL rule as the search page; the server re-checks both. */
	const customLoginUrlError = $derived.by(() => {
		if (!isCustom) return null;
		const trimmed = customLoginUrl.trim();
		if (!trimmed) return null;
		try {
			const parsed = new URL(trimmed);
			if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
				return 'Enter a full URL including https://';
			}
			return null;
		} catch {
			return 'Enter a full URL including https://';
		}
	});

	/**
	 * Curated-listing sites (SvelteJobs, X-Team) have no search entry page, so
	 * there is no form to type keywords into.
	 *
	 * A pasted URL does take keywords: the server stores it as the new site's
	 * search page, and the scraper drives that page's own search form. Leaving
	 * keywords empty imports the URL exactly as pasted, which is what someone
	 * who set the search up in their own browser wants.
	 */
	const keywordsApply = $derived(isCustom || !!selectedPlatform?.search_page_url);

	const canSubmit = $derived(
		!submitting && !customLoginUrlError && (isCustom ? !!customOrigin : platformId !== null)
	);

	/**
	 * Where the task will run. A connected device wins over the server-side
	 * browser: it scrapes from the user's own IP, which is the difference
	 * between working and being blocked on the boards that reject datacenter
	 * ranges. The add form used to hardcode "hosted", so a user with a device
	 * connected still got the cloud browser.
	 *
	 * With no device we send an empty provider rather than naming one, letting
	 * the create action apply the server's own default. That defers to operator
	 * config instead of pinning the row to a provider forever.
	 */
	/**
	 * "none" skips the login phase outright (scraper.ts), so a task that carries
	 * a login URL under it would collect the URL and never visit it. "manual"
	 * pauses the run and hands the browser over instead, which is the only mode
	 * that works here: this form collects no password. The task page can switch
	 * it to "auto" once credentials are saved.
	 */
	const loginMode = $derived(isCustom && customLoginUrl.trim() ? 'manual' : 'none');

	const runsOnDevice = $derived(preferredDevice !== null);
	const deviceLabel = $derived(
		preferredDevice
			? preferredDevice.isShared && preferredDevice.ownerLabel
				? `${preferredDevice.apiKeyName}, shared by ${preferredDevice.ownerLabel}`
				: preferredDevice.apiKeyName
			: null
	);
</script>

<form
	method="POST"
	action="?/create"
	class="space-y-4 rounded-lg border border-[var(--dash-primary)] bg-[var(--dash-card)] p-4"
	use:enhance={() => {
		submitting = true;
		return async ({ result, update }) => {
			submitting = false;
			if (result.type === 'success' && result.data && 'taskId' in result.data) {
				track('search_task_created');
				await goto(`/jobs/import/tasks/${result.data.taskId}`);
				return;
			}
			// Anything else is a failure, and a custom `enhance` callback that
			// returns without applying the result swallows it: `form` never
			// updates, so the page's `{#if form?.error}` banner has nothing to
			// show and the user sees the button re-enable with no explanation.
			// `reset: false` keeps what they typed — losing a pasted search URL
			// to a validation error would be its own bug.
			await update({ reset: false });
		};
	}}
>
	<h3 class="font-medium text-[var(--dash-text)]">Add Import Task</h3>

	<div>
		<label
			class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
			for="add-platform">Site</label
		>
		<PlatformCombobox
			id="add-platform"
			{platforms}
			bind:value={platformId}
			onCustom={adoptTypedSite}
		/>
	</div>

	{#if isCustom}
		<div>
			<label
				class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
				for="add-custom-url">Job search URL</label
			>
			<input
				id="add-custom-url"
				type="url"
				bind:value={customUrl}
				placeholder="https://example.com/jobs?q=python&sort=date"
				aria-invalid={customUrlError ? 'true' : undefined}
				class="w-full rounded border bg-[var(--dash-bg)] px-2 py-1.5 text-sm text-[var(--dash-text)] {customUrlError
					? 'border-[var(--dash-error)]'
					: 'border-[var(--dash-border)]'}"
			/>
			{#if customUrlError}
				<p class="mt-1 text-xs text-[var(--dash-error)]">{customUrlError}</p>
			{:else}
				<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
					The page you'd search jobs on, or a search you already set up in your own browser. Add
					keywords below and we type them into that page's own search box; leave them empty and we
					import the URL exactly as you pasted it.
				</p>
			{/if}
		</div>

		<div>
			<label
				class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
				for="add-custom-login-url"
				>Login page URL <span class="font-normal text-[var(--dash-text-muted)]">(optional)</span
				></label
			>
			<input
				id="add-custom-login-url"
				type="url"
				bind:value={customLoginUrl}
				placeholder="https://example.com/login"
				aria-invalid={customLoginUrlError ? 'true' : undefined}
				class="w-full rounded border bg-[var(--dash-bg)] px-2 py-1.5 text-sm text-[var(--dash-text)] {customLoginUrlError
					? 'border-[var(--dash-error)]'
					: 'border-[var(--dash-border)]'}"
			/>
			{#if customLoginUrlError}
				<p class="mt-1 text-xs text-[var(--dash-error)]">{customLoginUrlError}</p>
			{:else}
				<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
					Only if the site hides its jobs behind a sign-in. Add the credentials on the task page
					afterwards; without them the run stops and asks you to sign in yourself.
				</p>
			{/if}
		</div>

		<div>
			<label
				class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
				for="add-custom-name"
				>Site name <span class="font-normal text-[var(--dash-text-muted)]">(optional)</span></label
			>
			<input
				id="add-custom-name"
				type="text"
				bind:value={customName}
				placeholder={customOrigin
					? new URL(customOrigin).hostname.replace(/^www\./, '')
					: 'e.g. Acme Careers'}
				class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-sm text-[var(--dash-text)]"
			/>
			<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
				What to call this site in your task list. Defaults to its domain.
			</p>
		</div>
	{/if}

	{#if keywordsApply}
		<div>
			<label
				class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
				for="add-keywords"
				>Search keywords <span class="font-normal text-[var(--dash-text-muted)]">(optional)</span
				></label
			>
			<input
				id="add-keywords"
				type="text"
				bind:value={keywords}
				placeholder="e.g. python developer — leave empty to import all listings"
				class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-sm text-[var(--dash-text)]"
			/>
			<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
				Typed into the site's search input. Leave empty to import everything it lists.
			</p>
		</div>
	{:else}
		<p class="text-xs text-[var(--dash-text-muted)]">
			{selectedPlatform?.name ?? 'This site'} has no search form, so we import its listing page as-is.
		</p>
	{/if}

	<div class="border-t border-[var(--dash-border)] pt-3">
		<p class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">
			Filter preferences <span class="font-normal text-[var(--dash-text-muted)]"
				>(optional — the scraper applies them per-platform)</span
			>
		</p>
		<FilterPicker bind:filters compact={true} />
		{#if !keywordsApply}
			<p class="mt-2 text-xs text-[var(--dash-text-muted)]">
				With no search form to drive, sorting, date-posted and remote/on-site can't be set at the
				source here — put those in the URL if the site supports them. The rest (job type, hours,
				experience level) are enforced when we match, so they still apply.
			</p>
		{/if}
	</div>

	<div>
		<label class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]" for="add-note"
			>Note <span class="font-normal text-[var(--dash-text-muted)]">(optional)</span></label
		>
		<input
			id="add-note"
			type="text"
			bind:value={note}
			placeholder="e.g. Remote-leaning, recent posts only"
			class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-sm text-[var(--dash-text)]"
		/>
	</div>

	<!-- Hidden fields the server action expects. -->
	{#if isCustom}
		<!-- getOrCreatePlatform resolves the origin to an existing platform by
		     host, or creates a draft one. For a newly created one the pasted URL
		     also becomes its `search_page_url`, and the create action then drops
		     `search_url` from the task: a task-level URL makes the scraper skip
		     the search form, which would silently discard the keywords. -->
		<input type="hidden" name="platform_is_new" value="true" />
		<input type="hidden" name="platform_url" value={customOrigin ?? ''} />
		<input type="hidden" name="platform_name" value={customName.trim()} />
		<input type="hidden" name="login_page_url" value={customLoginUrl.trim()} />
		<input type="hidden" name="search_url" value={customUrl.trim()} />
	{:else if selectedPlatform}
		<input type="hidden" name="platform_id" value={selectedPlatform.id} />
	{/if}
	<input type="hidden" name="search_term" value={keywordsApply ? keywords : ''} />
	<input type="hidden" name="search_filters" value={JSON.stringify(filters)} />
	<input type="hidden" name="note" value={note} />
	{#if preferredDevice}
		<input type="hidden" name="browser_provider" value="tunnel" />
		<input type="hidden" name="sjsbrowser_api_key" value={String(preferredDevice.apiKeyId)} />
	{:else}
		<input type="hidden" name="browser_provider" value="" />
	{/if}
	<input type="hidden" name="login_mode" value={loginMode} />
	<input type="hidden" name="max_jobs" value={String(defaultMaxJobs ?? 25)} />
	<input type="hidden" name="stop_after_duplicates" value="5" />
	<input type="hidden" name="skip_existing" value="true" />
	<input type="hidden" name="keep_minimized" value="true" />

	<div class="flex items-center justify-between pt-2">
		<p class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)]">
			<FontAwesomeIcon icon={runsOnDevice ? faLaptop : faCloud} class="h-3 w-3" />
			{#if !deviceStatusChecked}
				Checking for a connected device…
			{:else if runsOnDevice}
				Runs on {deviceLabel}. Edit the task after creation for advanced options.
			{:else}
				Runs on our cloud browser. Connect a device for sites that block datacenter IPs.
			{/if}
		</p>
		<div class="flex gap-2">
			<button
				type="button"
				onclick={onCancel}
				class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>Cancel</button
			>
			<button
				type="submit"
				disabled={!canSubmit}
				class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-60"
				>{submitting ? 'Adding…' : 'Add Task'}</button
			>
		</div>
	</div>
</form>
