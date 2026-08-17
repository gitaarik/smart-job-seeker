<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faPlus, faTimes, faTags, faBan } from '@fortawesome/free-solid-svg-icons';
	import { portalToBody } from '$lib/actions/portal';

	/**
	 * Modal editor for an item's resume/CV version tags. Edits the bound `tags`
	 * array live (the parent persists via its own section save). Supports both
	 * positive whitelist tags ("show only on X") and negated excludes ("!X" =
	 * hide from X) — the exclude form is what the lean-baseline model relies on
	 * and no other tag UI can add it.
	 */
	let {
		title = 'Resume / CV Versions',
		subtitle,
		tags = $bindable([]),
		versionSlugs = [],
		onChange,
		onClose
	}: {
		title?: string;
		subtitle?: string;
		tags: string[];
		versionSlugs?: string[];
		/**
		 * The new tag list, for a parent that persists per row rather than through
		 * a section save it will run later. Fires on every add and remove, which
		 * is what keeps the chip's badge and the saved row in step while this is
		 * still open. Optional: a binding parent needs nothing.
		 */
		onChange?: (tags: string[]) => void;
		onClose: () => void;
	} = $props();

	const builtinTags = ['resume', 'cv'];

	let candidates = $derived([
		...builtinTags,
		...versionSlugs.filter((v) => !builtinTags.includes(v.toLowerCase()))
	]);

	function has(tag: string): boolean {
		return tags.some((t) => t.toLowerCase() === tag.toLowerCase());
	}

	// A version is "decided" once it appears in either form; don't re-suggest it.
	let available = $derived(candidates.filter((c) => !has(c) && !has(`!${c}`)));

	function addTag(tag: string) {
		if (has(tag)) return;
		tags = [...tags, tag];
		onChange?.(tags);
	}

	function removeTag(tag: string) {
		tags = tags.filter((t) => t !== tag);
		onChange?.(tags);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	use:portalToBody={{ onClose }}
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
>
	<div
		class="w-full max-w-lg rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-6 shadow-xl"
	>
		<h3 class="mb-1 flex items-center gap-2 text-lg font-semibold text-[var(--dash-text)]">
			<FontAwesomeIcon icon={faTags} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
			{title}
		</h3>
		{#if subtitle}
			<p class="mb-1 text-sm text-[var(--dash-text-secondary)]">{subtitle}</p>
		{/if}
		<p class="mb-4 text-xs text-[var(--dash-text-secondary)]">
			No tags means this appears in all versions. Use "show only on" to whitelist, or "hide from" to
			exclude it from specific versions.
		</p>

		<!-- Current tags -->
		{#if tags.length > 0}
			<div class="mb-4 flex flex-wrap gap-1.5">
				{#each tags as tag}
					{@const isExclude = tag.startsWith('!')}
					<button
						type="button"
						onclick={() => removeTag(tag)}
						class="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors
              {isExclude
							? 'border-amber-500/30 bg-amber-500/10 text-amber-700 hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-500'
							: 'border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-500'}"
					>
						{isExclude ? `hide from ${tag.slice(1)}` : tag}
						<FontAwesomeIcon icon={faTimes} class="h-2.5 w-2.5" />
					</button>
				{/each}
			</div>
		{:else}
			<p class="mb-4 text-xs text-[var(--dash-text-muted)] italic">All versions</p>
		{/if}

		{#if available.length > 0}
			<!-- Show only on (whitelist) -->
			<p class="mb-1.5 text-xs font-medium text-[var(--dash-text-secondary)]">Show only on</p>
			<div class="mb-3 flex flex-wrap gap-1.5">
				{#each available as c}
					<button
						type="button"
						onclick={() => addTag(c)}
						class="inline-flex items-center gap-1 rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary)]"
					>
						<FontAwesomeIcon icon={faPlus} class="h-2.5 w-2.5" />
						{c}
					</button>
				{/each}
			</div>

			<!-- Hide from (exclude) -->
			<p class="mb-1.5 text-xs font-medium text-[var(--dash-text-secondary)]">Hide from</p>
			<div class="flex flex-wrap gap-1.5">
				{#each available as c}
					<button
						type="button"
						onclick={() => addTag(`!${c}`)}
						class="inline-flex items-center gap-1 rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-amber-500/40 hover:text-amber-700"
					>
						<FontAwesomeIcon icon={faBan} class="h-2.5 w-2.5" />
						{c}
					</button>
				{/each}
			</div>
		{/if}

		<div class="mt-6 flex justify-end">
			<button
				type="button"
				onclick={onClose}
				class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
			>
				Done
			</button>
		</div>
	</div>
</div>
