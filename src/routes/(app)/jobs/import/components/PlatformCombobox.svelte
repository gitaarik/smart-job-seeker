<script lang="ts">
	/**
	 * Type-to-filter picker for the site an import task runs against, with a
	 * standing "add it yourself" row for anything we don't have.
	 *
	 * It replaces a plain `<select>`. That worked while the list was short, but
	 * it scales badly in both directions: scrolling a flat alphabetical list to
	 * find Indeed is slow once there are dozens of platforms, and the one option
	 * that matters most to a user whose board is missing — "Other site" — was
	 * buried at the bottom under everything that wasn't what they wanted.
	 *
	 * The create row is always present rather than appearing only on an empty
	 * result, because "no matches" is not the only time you want it: a search
	 * for "jobs" matches several platforms and still may not contain yours.
	 *
	 * Matching covers the hostname as well as the name, so pasting or typing
	 * `linkedin.com` finds LinkedIn. That is the same input a user reaches for
	 * when they are about to add a site by hand, so it gets a chance to tell
	 * them we already have it before they do the work.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck, faChevronDown, faPlus } from '@fortawesome/free-solid-svg-icons';
	import { clickOutside } from '$lib/actions/popover';
	import { CUSTOM_PLATFORM_ID } from '$lib/import-tasks/custom-site';

	export type ComboboxPlatform = {
		id: number;
		key: string;
		name: string;
		url: string;
		search_page_url: string | null;
	};

	interface Props {
		platforms: ComboboxPlatform[];
		/** Selected platform id, or CUSTOM_PLATFORM_ID, or null when nothing is chosen. */
		value: number | null;
		/**
		 * Called when the user picks the create row, with whatever they had
		 * typed. The parent uses it to prefill the URL or name field, so the
		 * search doubles as the first field of the add-a-site form.
		 */
		onCustom?: (query: string) => void;
		id?: string;
	}

	let { platforms, value = $bindable(), onCustom, id = 'platform-combobox' }: Props = $props();

	let query = $state('');
	let open = $state(false);
	let activeIndex = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLUListElement | null>(null);

	const selected = $derived(platforms.find((p) => p.id === value) ?? null);
	const isCustom = $derived(value === CUSTOM_PLATFORM_ID);

	/** Hostname without `www.`, for both matching and the secondary line. */
	function host(url: string): string {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return '';
		}
	}

	const matches = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return platforms;
		// Strip a scheme so typing a full URL still matches on host. Users reach
		// for the address bar's spelling, not ours.
		const bare = q.replace(/^https?:\/\//, '').replace(/^www\./, '');
		return platforms.filter(
			(p) =>
				p.name.toLowerCase().includes(q) ||
				p.key.toLowerCase().includes(bare) ||
				host(p.url).includes(bare)
		);
	});

	// Split the same way the old <select> grouped its options: a listing page
	// has no search form to drive, so it imports whatever it happens to show.
	// That difference decides whether the keyword box means anything, which is
	// worth seeing before you choose rather than after.
	const searchable = $derived(matches.filter((p) => p.search_page_url));
	const listingOnly = $derived(matches.filter((p) => !p.search_page_url));

	/**
	 * Flat list in render order, so arrow keys move through what the eye sees
	 * rather than through the unsplit array. The create row is last and is
	 * addressed as `matches.length`.
	 */
	const ordered = $derived([...searchable, ...listingOnly]);
	const createIndex = $derived(ordered.length);

	/**
	 * Set while we hand focus back to the input after a pick. `focus` opens the
	 * list, and returning focus is a focus event like any other, so without
	 * this every selection reopens the list it just closed — and because the
	 * open input shows the (now cleared) query rather than the selection, the
	 * field also reads as empty right after you choose something.
	 */
	let refocusing = false;

	function openList() {
		if (open || refocusing) return;
		open = true;
		// Start on the create row when nothing matches, so Enter does the one
		// thing available instead of nothing.
		activeIndex = ordered.length > 0 ? 0 : createIndex;
	}

	function close() {
		open = false;
		query = '';
	}

	/** Return focus to the input without the focus handler reopening the list. */
	function refocus() {
		refocusing = true;
		inputEl?.focus();
		refocusing = false;
	}

	function choose(p: ComboboxPlatform) {
		value = p.id;
		close();
		refocus();
	}

	function chooseCustom() {
		const typed = query.trim();
		value = CUSTOM_PLATFORM_ID;
		close();
		onCustom?.(typed);
		refocus();
	}

	function commitActive() {
		if (activeIndex === createIndex) {
			chooseCustom();
			return;
		}
		const p = ordered[activeIndex];
		if (p) choose(p);
	}

	function move(delta: number) {
		const last = createIndex;
		const next = activeIndex + delta;
		// Wrap, so ArrowUp from the top reaches the create row in one press.
		activeIndex = next < 0 ? last : next > last ? 0 : next;
		scrollActiveIntoView();
	}

	function scrollActiveIntoView() {
		// Deferred: the class change that marks the active row has not been
		// applied yet when this runs from the keydown handler.
		queueMicrotask(() => {
			const el = listEl?.querySelector<HTMLElement>('[data-active="true"]');
			// Optional call, not just optional chaining: jsdom has no
			// scrollIntoView, and an unhandled rejection out of a microtask
			// fails the whole test file rather than the line that caused it.
			el?.scrollIntoView?.({ block: 'nearest' });
		});
	}

	function onKeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				if (!open) openList();
				else move(1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				if (!open) openList();
				else move(-1);
				break;
			case 'Enter':
				// Only swallow Enter while the list is open. Closed, it has to
				// reach the form so the picker does not block submitting.
				if (open) {
					event.preventDefault();
					commitActive();
				}
				break;
			case 'Escape':
				if (open) {
					event.stopPropagation();
					close();
				}
				break;
			case 'Tab':
				if (open) close();
				break;
		}
	}

	function onInput(event: Event) {
		query = (event.target as HTMLInputElement).value;
		open = true;
		activeIndex = ordered.length > 0 ? 0 : createIndex;
	}

	/**
	 * What the closed input shows. Typing replaces it; the current choice comes
	 * back the moment the list closes, so an abandoned search never looks like
	 * it changed the selection.
	 */
	const displayValue = $derived(
		open ? query : isCustom ? 'A site we don’t have yet' : (selected?.name ?? '')
	);

	const optionId = (i: number) => `${id}-opt-${i}`;
</script>

<div class="relative" use:clickOutside={() => open && close()}>
	<div class="relative">
		<input
			bind:this={inputEl}
			{id}
			type="text"
			role="combobox"
			autocomplete="off"
			aria-expanded={open}
			aria-controls="{id}-list"
			aria-activedescendant={open ? optionId(activeIndex) : undefined}
			value={displayValue}
			oninput={onInput}
			onkeydown={onKeydown}
			onfocus={openList}
			onclick={openList}
			placeholder="Search sites, or type a name or URL to add one"
			class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] py-1.5 pr-8 pl-2 text-sm text-[var(--dash-text)]"
		/>
		<FontAwesomeIcon
			icon={faChevronDown}
			class="pointer-events-none absolute top-1/2 right-2.5 h-3 w-3 -translate-y-1/2 text-[var(--dash-text-muted)]"
		/>
	</div>

	{#if open}
		<!--
			The options carry click handlers and no key handlers, which the
			compiler flags. That is the ARIA combobox pattern rather than an
			oversight: focus stays on the input and the active option is named by
			aria-activedescendant, so every keyboard interaction is already
			handled in onKeydown above. Making each row focusable would break
			that, since leaving the input would close the list.
		-->
		<ul
			bind:this={listEl}
			id="{id}-list"
			role="listbox"
			aria-label="Sites"
			class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
		>
			{@render group('Sites we can search', searchable, 0)}
			{@render group('Listing pages (imported as-is)', listingOnly, searchable.length)}

			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<li
				id={optionId(createIndex)}
				role="option"
				aria-selected={isCustom}
				data-active={activeIndex === createIndex}
				class="mt-1 flex cursor-pointer items-center gap-2 border-t border-[var(--dash-border)] px-2 py-1.5 text-sm {activeIndex ===
				createIndex
					? 'bg-[var(--dash-bg)]'
					: ''}"
				onmouseenter={() => (activeIndex = createIndex)}
				onclick={chooseCustom}
			>
				<FontAwesomeIcon icon={faPlus} class="h-3 w-3 text-[var(--dash-primary)]" />
				<span class="truncate text-[var(--dash-text)]">
					{#if query.trim()}
						<!-- Quoted, because the search is often a fragment rather than a
						     name: unquoted, a search for "in" reads "Add in as a new
						     site", which parses as a sentence and means nothing. -->
						Add <span class="font-medium">“{query.trim()}”</span> as a new site
					{:else}
						Add a site we don’t have yet
					{/if}
				</span>
			</li>

			{#if ordered.length === 0 && query.trim()}
				<li role="presentation" class="px-2 pt-1 pb-1.5 text-xs text-[var(--dash-text-muted)]">
					Nothing here matches “{query.trim()}”.
				</li>
			{/if}
		</ul>
	{/if}
</div>

{#snippet group(heading: string, rows: ComboboxPlatform[], offset: number)}
	{#if rows.length > 0}
		<li
			role="presentation"
			class="px-2 py-1 text-[10px] font-medium tracking-wide text-[var(--dash-text-muted)] uppercase"
		>
			{heading}
		</li>
		{#each rows as p, i (p.id)}
			{@const index = offset + i}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<li
				id={optionId(index)}
				role="option"
				aria-selected={value === p.id}
				data-active={activeIndex === index}
				class="flex cursor-pointer items-center justify-between gap-2 px-2 py-1.5 text-sm {activeIndex ===
				index
					? 'bg-[var(--dash-bg)]'
					: ''}"
				onmouseenter={() => (activeIndex = index)}
				onclick={() => choose(p)}
			>
				<span class="truncate text-[var(--dash-text)]">{p.name}</span>
				<span class="flex shrink-0 items-center gap-1.5">
					<span class="text-xs text-[var(--dash-text-muted)]">{host(p.url)}</span>
					{#if value === p.id}
						<FontAwesomeIcon icon={faCheck} class="h-3 w-3 text-[var(--dash-primary)]" />
					{/if}
				</span>
			</li>
		{/each}
	{/if}
{/snippet}
