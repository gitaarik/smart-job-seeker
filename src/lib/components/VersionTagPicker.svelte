<script lang="ts">
	/**
	 * The collapsible "Resume / CV Versions" block of an item's editor popup:
	 * the user-defined versions it is shown only on (`slug`) or kept off
	 * (`!slug`).
	 *
	 * The base templates are not offered here. They are the Show-on switches
	 * beside this, and listing them twice would let the two disagree. Every
	 * change reports the item's whole new tag list, base templates carried
	 * through, so the caller writes one array and cannot drop a switch.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faBan,
		faChevronDown,
		faChevronRight,
		faPlus,
		faTags,
		faTimes
	} from '@fortawesome/free-solid-svg-icons';
	import {
		BASE_TEMPLATE_TAGS,
		isHiddenFromDocuments,
		tagSlug,
		versionTagsOf
	} from '$lib/profile-visibility';

	interface Props {
		/** The item's tags as stored, base templates included. */
		tags: string[] | null | undefined;
		versionSlugs: string[];
		/** The item's whole new tag list, empty when nothing is left. */
		onchange: (tags: string[]) => void;
		expanded?: boolean;
	}

	let { tags, versionSlugs, onchange, expanded = $bindable(false) }: Props = $props();

	let stored = $derived(tags ?? []);
	let profileOnly = $derived(isHiddenFromDocuments(stored));
	let chips = $derived(versionTagsOf(stored));

	let suggestions = $derived.by(() => {
		// Suggest from the stored tags, not the displayed chips: a version already
		// decided in either form (include or exclude) shouldn't be offered again.
		const used = new Set(stored.map(tagSlug));
		return versionSlugs.filter(
			(v) => !BASE_TEMPLATE_TAGS.includes(tagSlug(v)) && !used.has(v.toLowerCase())
		);
	});

	function add(tag: string) {
		const trimmed = tag.trim();
		if (!trimmed) return;
		// Skip if this version is already tagged in either include or exclude form.
		if (stored.some((t) => tagSlug(t) === tagSlug(trimmed))) return;
		onchange([...stored, trimmed]);
	}

	function remove(tag: string) {
		onchange(stored.filter((t) => t !== tag));
	}
</script>

{#if versionSlugs.length > 0}
	<div>
		<button
			type="button"
			onclick={() => (expanded = !expanded)}
			class="mb-1 flex items-center gap-1 text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase transition-colors hover:text-[var(--dash-text-secondary)]"
		>
			<FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} class="h-2 w-2" />
			<FontAwesomeIcon icon={faTags} class="h-2.5 w-2.5" />
			Resume / CV Versions
			{#if !expanded && chips.length > 0}
				<span class="text-[var(--dash-primary)] normal-case">({chips.length})</span>
			{/if}
		</button>
		{#if expanded}
			{#if chips.length > 0}
				<div class="mb-1.5 flex flex-wrap gap-1.5">
					{#each chips as tag, i (i)}
						{@const isNeg = tag.startsWith('!')}
						<button
							type="button"
							onclick={() => remove(tag)}
							class="inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-xs transition-colors hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-500 {isNeg
								? 'border-red-500/25 bg-red-500/10 text-red-600'
								: 'border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'}"
						>
							{#if isNeg}
								<FontAwesomeIcon icon={faBan} class="h-2.5 w-2.5" />
							{/if}
							{isNeg ? tag.slice(1) : tag}
							<FontAwesomeIcon icon={faTimes} class="h-2.5 w-2.5" />
						</button>
					{/each}
				</div>
			{:else}
				<p class="mb-1.5 text-[10px] text-[var(--dash-text-muted)] italic">
					{profileOnly ? 'No document' : 'All versions'}
				</p>
			{/if}
			{#if suggestions.length > 0}
				<p class="mb-1 text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase">
					{profileOnly ? 'Show anyway on' : 'Show only on'}
				</p>
				<div class="mb-2 flex flex-wrap gap-1.5">
					{#each suggestions as suggestion, i (i)}
						<button
							type="button"
							onclick={() => add(suggestion)}
							class="inline-flex items-center gap-1 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary)]"
						>
							<FontAwesomeIcon icon={faPlus} class="h-2.5 w-2.5" />
							{suggestion}
						</button>
					{/each}
				</div>
				<p class="mb-1 text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase">
					Exclude from
				</p>
				<div class="flex flex-wrap gap-1.5">
					{#each suggestions as suggestion, i (i)}
						<button
							type="button"
							onclick={() => add('!' + suggestion)}
							class="inline-flex items-center gap-1 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-red-500/40 hover:text-red-500"
						>
							<FontAwesomeIcon icon={faBan} class="h-2.5 w-2.5" />
							{suggestion}
						</button>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
{/if}
