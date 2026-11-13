<script lang="ts">
	/*
	 * Pick a real place from the gazetteer (`GET /api/places`, planning/
	 * STRUCTURED-LOCATIONS.md): a city, a province, a country or a region,
	 * stored whole as a `Place`. One place (`value`), or a list shown as chips
	 * (`multiple`, `places`). GeoNames is CC BY 4.0, so the list of suggestions
	 * credits it.
	 */
	import { onMount } from 'svelte';
	import type { Place, PlaceKind, PreferredPlace } from '$lib/data/places';
	import ExternalLink from '$lib/components/ExternalLink.svelte';

	let {
		value = $bindable(null),
		places = $bindable([]),
		multiple = false,
		placeholder = 'Search a city, country or region...',
		disabled = false,
		id,
		onpick
	}: {
		/** The one place, when not `multiple`. */
		value?: Place | null;
		/** The list, when `multiple`. A kept place keeps its `radius_km`. */
		places?: PreferredPlace[];
		multiple?: boolean;
		placeholder?: string;
		disabled?: boolean;
		/** On the text input, for a `<label for>` outside the component. */
		id?: string;
		/** After a pick (or a clear, with null), once `value` or `places` holds it. */
		onpick?: (place: Place | null) => void;
	} = $props();

	const uid = $props.id();
	const listId = `${uid}-places`;

	const KIND_LABEL: Record<PlaceKind, string> = {
		city: 'City',
		admin: 'Province',
		country: 'Country',
		region: 'Region'
	};

	let query = $state('');
	let open = $state(false);
	let results = $state<Place[]>([]);
	let loading = $state(false);
	let highlight = $state(-1);
	let containerEl: HTMLDivElement | undefined = $state();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | undefined;

	/** The suggestions, without what the list already holds. */
	const shown = $derived(
		multiple ? results.filter((r) => !places.some((p) => p.id === r.id)) : results
	);

	function search(q: string) {
		clearTimeout(timer);
		controller?.abort();
		if (!q.trim()) {
			results = [];
			loading = false;
			return;
		}
		loading = true;
		timer = setTimeout(async () => {
			const mine = new AbortController();
			controller = mine;
			try {
				const res = await fetch(`/api/places?q=${encodeURIComponent(q)}&limit=8`, {
					signal: mine.signal
				});
				if (!res.ok) throw new Error(`places ${res.status}`);
				results = (await res.json()).places ?? [];
				highlight = results.length ? 0 : -1;
			} catch (e) {
				if ((e as Error).name === 'AbortError') return;
				results = [];
			} finally {
				if (controller === mine) loading = false;
			}
		}, 150);
	}

	function pick(place: Place) {
		if (multiple) places = [...places, place];
		else value = place;
		query = '';
		results = [];
		open = false;
		highlight = -1;
		onpick?.(place);
	}

	function remove(place: Place) {
		places = places.filter((p) => p.id !== place.id);
		onpick?.(null);
	}

	function clear() {
		value = null;
		onpick?.(null);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
			return;
		}
		if (!open || !shown.length) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlight = Math.min(highlight + 1, shown.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlight = Math.max(highlight - 1, 0);
		} else if (e.key === 'Enter') {
			const choice = shown[highlight];
			if (!choice) return;
			e.preventDefault();
			pick(choice);
		}
	}

	onMount(() => {
		const outside = (e: MouseEvent) => {
			if (containerEl && !containerEl.contains(e.target as Node)) open = false;
		};
		document.addEventListener('mousedown', outside);
		return () => {
			document.removeEventListener('mousedown', outside);
			clearTimeout(timer);
			controller?.abort();
		};
	});
</script>

<div class="relative" bind:this={containerEl}>
	{#if multiple && places.length}
		<div class="mb-2 flex flex-wrap gap-2">
			{#each places as place (place.id)}
				<span
					class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary-light)] px-3 py-1.5 text-sm text-[var(--dash-primary)]"
					title={place.kind === 'region' ? `${place.countries.length} countries` : undefined}
				>
					{place.label}
					<button
						type="button"
						onclick={() => remove(place)}
						{disabled}
						class="transition-colors hover:text-[var(--dash-error)]"
						aria-label="Remove {place.label}"
					>
						&times;
					</button>
				</span>
			{/each}
		</div>
	{/if}

	{#if !multiple && value && !open}
		<div
			class="flex w-full items-center gap-2 rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-sm text-[var(--dash-text)]"
		>
			<button
				type="button"
				{id}
				{disabled}
				onclick={() => (open = true)}
				class="flex-1 truncate text-left"
				title="Change the place">{value.label}</button
			>
			<span class="text-xs text-[var(--dash-text-muted)]">{KIND_LABEL[value.kind]}</span>
			<button
				type="button"
				onclick={clear}
				{disabled}
				class="p-0.5 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
				aria-label="Clear the place"
			>
				&times;
			</button>
		</div>
	{:else}
		<input
			{id}
			type="text"
			autocomplete="off"
			role="combobox"
			aria-expanded={open && !!query.trim()}
			aria-controls={listId}
			aria-autocomplete="list"
			bind:value={query}
			oninput={() => {
				open = true;
				highlight = -1;
				search(query);
			}}
			onfocus={() => (open = true)}
			{onkeydown}
			{placeholder}
			{disabled}
			class="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none disabled:opacity-50"
		/>
	{/if}

	{#if open && query.trim()}
		<div
			class="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] shadow-lg"
		>
			<div id={listId} role="listbox" class="max-h-64 overflow-y-auto">
				{#each shown as place, i (place.id)}
					<button
						type="button"
						role="option"
						aria-selected={i === highlight}
						onclick={() => pick(place)}
						onmouseenter={() => (highlight = i)}
						class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--dash-text)] transition-colors
							{i === highlight ? 'bg-[var(--dash-primary)]/10' : 'hover:bg-[var(--dash-bg)]'}"
					>
						<span class="flex-1 truncate">{place.label}</span>
						<span class="text-xs text-[var(--dash-text-muted)]">
							{KIND_LABEL[place.kind]}{place.kind === 'region'
								? `, ${place.countries.length} countries`
								: ''}
						</span>
					</button>
				{/each}
				{#if !shown.length}
					<div class="px-3 py-2 text-sm text-[var(--dash-text-muted)]">
						{loading ? 'Searching...' : 'No place found'}
					</div>
				{/if}
			</div>
			<div
				class="border-t border-[var(--dash-border)] px-3 py-1 text-[10px] text-[var(--dash-text-muted)]"
			>
				Places from <ExternalLink href="https://www.geonames.org/" class="underline"
					>GeoNames</ExternalLink
				>, <ExternalLink href="https://creativecommons.org/licenses/by/4.0/" class="underline"
					>CC BY 4.0</ExternalLink
				>
			</div>
		</div>
	{/if}
</div>
