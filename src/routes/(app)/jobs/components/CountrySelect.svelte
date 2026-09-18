<script module lang="ts">
	// Import only the JSON locale data — no runtime library needed.
	// Vite handles JSON imports natively for both SSR and client builds.
	import enLocale from 'i18n-iso-countries/langs/en.json';
	import deLocale from 'i18n-iso-countries/langs/de.json';
	import frLocale from 'i18n-iso-countries/langs/fr.json';
	import esLocale from 'i18n-iso-countries/langs/es.json';
	import nlLocale from 'i18n-iso-countries/langs/nl.json';
	import ptLocale from 'i18n-iso-countries/langs/pt.json';
	import itLocale from 'i18n-iso-countries/langs/it.json';
	import jaLocale from 'i18n-iso-countries/langs/ja.json';
	import zhLocale from 'i18n-iso-countries/langs/zh.json';

	type LocaleData = { countries: Record<string, string | string[]> };
	const locales: LocaleData[] = [
		enLocale,
		deLocale,
		frLocale,
		esLocale,
		nlLocale,
		ptLocale,
		itLocale,
		jaLocale,
		zhLocale
	];

	interface Country {
		code: string;
		name: string;
		flag: string;
		searchNames: string[];
	}

	function codeToFlag(code: string): string {
		return String.fromCodePoint(
			...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
		);
	}

	/**
	 * Every country, with the names nine locales know it by.
	 *
	 * In `<script module>` because it depends on nothing but the imports: a
	 * couple of thousand strings folded into ~250 rows, and the instance script
	 * ran it on every mount. The import config page alone mounts one of these
	 * per row, so opening it built the whole table over and over for a value
	 * that cannot differ between them.
	 */
	const COUNTRIES: Country[] = (() => {
		const enCountries = enLocale.countries as Record<string, string | string[]>;

		return Object.keys(enCountries)
			.map((code) => {
				// Deduped against the array rather than through a Set:
				// svelte/prefer-svelte-reactivity flags any mutable Set in a
				// .svelte file, and a SvelteSet would wrap a dozen strings built
				// once at module load in reactivity nothing will ever read.
				const searchNames: string[] = [];

				// Collect names from all locales (English first, then others)
				for (const locale of locales) {
					const entry = (locale.countries as Record<string, string | string[]>)[code];
					if (!entry) continue;
					// Entry is either a string or array of strings (aliases)
					for (const name of Array.isArray(entry) ? entry : [entry]) {
						const lower = name.toLowerCase();
						if (!searchNames.includes(lower)) searchNames.push(lower);
					}
				}

				// Primary display name: first English name
				const enEntry = enCountries[code];
				const displayName = Array.isArray(enEntry) ? enEntry[0] : enEntry;

				return {
					code,
					name: displayName,
					flag: codeToFlag(code),
					searchNames
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name));
	})();
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	let {
		value = $bindable(''),
		placeholder = '',
		fallback = '',
		disabled = false
	}: {
		value: string;
		placeholder?: string;
		/** Country code to display when value is empty (e.g., from profile location) */
		fallback?: string;
		disabled?: boolean;
	} = $props();

	let searchText = $state('');
	let isOpen = $state(false);
	let highlightIndex = $state(-1);
	let containerEl: HTMLDivElement | undefined = $state();
	let dropdownEl: HTMLDivElement | undefined = $state();

	/** The country to display: explicit value, or fallback */
	const displayCode = $derived(value || fallback);
	const displayCountry = $derived(COUNTRIES.find((c) => c.code === displayCode));

	const displayText = $derived(
		isOpen ? searchText : displayCountry ? `${displayCountry.flag} ${displayCountry.name}` : ''
	);

	const filtered = $derived.by(() => {
		if (!searchText) return COUNTRIES;
		const q = searchText.toLowerCase();
		return COUNTRIES.filter(
			(c) => c.code.toLowerCase().includes(q) || c.searchNames.some((n) => n.includes(q))
		);
	});

	function open() {
		isOpen = true;
		searchText = '';
		highlightIndex = -1;
	}

	function close() {
		isOpen = false;
		searchText = '';
		highlightIndex = -1;
	}

	function select(country: Country) {
		value = country.code;
		close();
	}

	function clear() {
		value = '';
		close();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!isOpen) {
			if (e.key === 'ArrowDown' || e.key === 'Enter') {
				e.preventDefault();
				open();
			}
			return;
		}

		if (e.key === 'Escape') {
			e.preventDefault();
			close();
			return;
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlightIndex = Math.min(highlightIndex + 1, filtered.length - 1);
			scrollToHighlighted();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightIndex = Math.max(highlightIndex - 1, 0);
			scrollToHighlighted();
		} else if (e.key === 'Enter') {
			const choice = filtered[highlightIndex];
			if (!choice) return;
			e.preventDefault();
			select(choice);
		}
	}

	function scrollToHighlighted() {
		if (!dropdownEl) return;
		const item = dropdownEl.children[highlightIndex] as HTMLElement;
		item?.scrollIntoView({ block: 'nearest' });
	}

	function handleClickOutside(e: MouseEvent) {
		if (containerEl && !containerEl.contains(e.target as Node)) {
			close();
		}
	}

	onMount(() => {
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	});
</script>

<div class="relative" bind:this={containerEl}>
	<input
		type="text"
		value={displayText}
		oninput={(e) => {
			searchText = (e.target as HTMLInputElement).value;
			// The highlight indexes into `filtered`, which this keystroke is about
			// to shrink. Arrowing to Denmark and then typing "z" left the index at
			// 57 over a list of one, and Enter read filtered[57] — undefined, and
			// `select` dereferenced it.
			highlightIndex = -1;
			if (!isOpen) open();
		}}
		onfocus={() => {
			if (!disabled) open();
		}}
		onkeydown={handleKeydown}
		placeholder={placeholder || 'Select country...'}
		{disabled}
		class="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 pr-8 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none disabled:opacity-50"
	/>

	{#if value && !isOpen}
		<!-- Show clear button only when an explicit value is set (not just fallback) -->
		<button
			type="button"
			onclick={clear}
			class="absolute top-1/2 right-2.5 -translate-y-1/2 p-0.5 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
			title="Clear"
		>
			<svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M2 2l8 8M10 2l-8 8" />
			</svg>
		</button>
	{/if}

	{#if isOpen}
		<div
			bind:this={dropdownEl}
			class="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] shadow-lg"
		>
			{#each filtered as country, i (i)}
				<button
					type="button"
					onclick={() => select(country)}
					class="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors
            {i === highlightIndex
						? 'bg-[var(--dash-primary)]/10 text-[var(--dash-text)]'
						: country.code === displayCode
							? 'bg-[var(--dash-bg)] text-[var(--dash-text)]'
							: 'text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'}"
				>
					<span>{country.flag}</span>
					<span class="flex-1 truncate">{country.name}</span>
					<span class="text-xs text-[var(--dash-text-muted)]">{country.code}</span>
				</button>
			{/each}
			{#if filtered.length === 0}
				<div class="px-2.5 py-2 text-sm text-[var(--dash-text-muted)]">No countries found</div>
			{/if}
		</div>
	{/if}
</div>
