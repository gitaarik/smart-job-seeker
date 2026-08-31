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
	 * all stayed. This re-exposes them: the user pastes the results URL they
	 * already have open, and the scraper navigates straight to it. Extraction
	 * is generic (AX tree + LLM identification, no per-site selectors), so an
	 * arbitrary site works without any platform-specific configuration.
	 */
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faMagicWandSparkles } from '@fortawesome/free-solid-svg-icons';
	import { track } from '$lib/tools/analytics';
	import type { SearchFilterValue } from '$lib/job-platforms/search-filters';
	import FilterPicker from './FilterPicker.svelte';

	export type ImportablePlatform = {
		id: number;
		key: string;
		name: string;
		url: string;
		search_page_url: string | null;
	};

	interface Props {
		platforms: ImportablePlatform[];
		defaultMaxJobs: number | null;
		onCancel: () => void;
	}

	let { platforms, defaultMaxJobs, onCancel }: Props = $props();

	/** Sentinel `<select>` value for the paste-your-own-URL branch. */
	const CUSTOM = -1;

	// Split by whether the scraper has a search form to drive. Both work, but
	// they behave differently enough that lumping them into one flat list would
	// mislead: a listing site imports whatever its page happens to show, with no
	// keywords and no source-side filtering.
	const searchable = $derived(platforms.filter((p) => p.search_page_url));
	const listingOnly = $derived(platforms.filter((p) => !p.search_page_url));

	// Default to a site the keyword box actually works on. Ordering by id put
	// Turing first once the search_page_url requirement was lifted, which is a
	// marketing homepage rather than a job list.
	let platformId = $state<number | null>(
		platforms.find((p) => p.search_page_url)?.id ?? platforms[0]?.id ?? CUSTOM
	);
	let customUrl = $state('');
	let customName = $state('');
	let keywords = $state('');
	let note = $state('');
	let filters = $state<Record<string, SearchFilterValue>>({});
	let submitting = $state(false);

	const isCustom = $derived(platformId === CUSTOM);
	const selectedPlatform = $derived(platforms.find((p) => p.id === platformId) ?? null);

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

	/**
	 * Curated-listing sites (SvelteJobs, X-Team) have no search entry page, so
	 * there is no form to type keywords into. Same for a pasted URL, which
	 * already encodes whatever search the user set up in their own browser.
	 */
	const keywordsApply = $derived(!isCustom && !!selectedPlatform?.search_page_url);

	const canSubmit = $derived(!submitting && (isCustom ? !!customOrigin : platformId !== null));
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
		<select
			id="add-platform"
			bind:value={platformId}
			class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-sm text-[var(--dash-text)]"
		>
			{#if searchable.length > 0}
				<optgroup label="Sites we can search">
					{#each searchable as p (p.id)}
						<option value={p.id}>{p.name}</option>
					{/each}
				</optgroup>
			{/if}
			{#if listingOnly.length > 0}
				<optgroup label="Listing pages (imported as-is)">
					{#each listingOnly as p (p.id)}
						<option value={p.id}>{p.name}</option>
					{/each}
				</optgroup>
			{/if}
			<optgroup label="Anywhere else">
				<option value={CUSTOM}>Other site (paste a search URL)…</option>
			</optgroup>
		</select>
	</div>

	{#if isCustom}
		<div>
			<label
				class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
				for="add-custom-url">Search results URL</label
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
					Set the search up in your own browser, then paste the address bar here. We go straight to
					that page and import what's listed, so any keywords, location and sorting already in the
					URL are kept exactly as you set them.
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
			{#if isCustom}
				No keyword box: the URL you paste already carries the search.
			{:else}
				{selectedPlatform?.name ?? 'This site'} has no search form — we import its listing page as-is.
			{/if}
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
		     host, or creates a draft one. `search_url` is what the scraper
		     actually navigates to, and it takes precedence over the platform's
		     own search page. -->
		<input type="hidden" name="platform_is_new" value="true" />
		<input type="hidden" name="platform_url" value={customOrigin ?? ''} />
		<input type="hidden" name="platform_name" value={customName.trim()} />
		<input type="hidden" name="search_url" value={customUrl.trim()} />
	{:else if selectedPlatform}
		<input type="hidden" name="platform_id" value={selectedPlatform.id} />
	{/if}
	<input type="hidden" name="search_term" value={keywordsApply ? keywords : ''} />
	<input type="hidden" name="search_filters" value={JSON.stringify(filters)} />
	<input type="hidden" name="note" value={note} />
	<input type="hidden" name="browser_provider" value="hosted" />
	<input type="hidden" name="login_mode" value="none" />
	<input type="hidden" name="max_jobs" value={String(defaultMaxJobs ?? 25)} />
	<input type="hidden" name="stop_after_duplicates" value="5" />
	<input type="hidden" name="skip_existing" value="true" />
	<input type="hidden" name="keep_minimized" value="true" />

	<div class="flex items-center justify-between pt-2">
		<p class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)]">
			<FontAwesomeIcon icon={faMagicWandSparkles} class="h-3 w-3" />
			Runs on our cloud scraper. Edit the task after creation for advanced options.
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
