<script lang="ts">
	import { untrack } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faTags } from '@fortawesome/free-solid-svg-icons';
	import { remountOnAppliedChange } from '$lib/components/applied-change.svelte';
	import { arraysEqual, autoSaveField } from '$lib/components/auto-save.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import VersionTagsPopup from '$lib/components/VersionTagsPopup.svelte';

	/**
	 * Which resumes and CVs print one certificate, in its expanded card.
	 *
	 * The same tags a role, an education entry or a skill carries, edited in the
	 * popup a role's technologies use: "show only on" a document or a version,
	 * or "hide from" one. They save the moment they change, like the skill chips
	 * and the file beside them, because the card's Save posts the fields' form
	 * and the tags are not in it.
	 */
	interface Props {
		certificateId: number;
		/** Named in the popup, which covers the card it was opened from. */
		name: string;
		/** The row's `tags` as loaded: a list, or null for "every document". */
		tags: unknown;
		/** The library versions a tag can name, from /api/profile-versions. */
		versionSlugs: string[];
		/** After a write lands, so the collapsed card's summary catches up. */
		onChanged?: () => void;
	}

	let { certificateId, name, tags, versionSlugs, onChanged }: Props = $props();

	// Seeded once: the field owns the tags from here, and a proposal applied from
	// the chat panel mounts this again rather than re-seeding it underneath.
	remountOnAppliedChange();
	const loaded = untrack(() => ({
		certificateId,
		tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : []
	}));

	const field = autoSaveField<string[]>({
		initial: loaded.tags,
		equal: arraysEqual,
		save: async (value, saved) => {
			// `expected` is what this card last saw stored, so a tag changed
			// somewhere else since (the assistant, another tab) is refused rather
			// than silently written over.
			const response = await fetch(`/api/profile-section/certificate/${loaded.certificateId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tags: value.length > 0 ? value : null,
					expected: { tags: saved.length > 0 ? saved : null }
				})
			});
			if (!response.ok) {
				const failed = await response.json().catch(() => ({}));
				throw new Error(failed.message || failed.error || `Save failed (${response.status})`);
			}
		},
		onSaved: () => onChanged?.()
	});

	let editing = $state(false);
</script>

<div>
	<div class="mb-2 flex items-center gap-3">
		<h4 class="text-sm font-medium text-[var(--dash-text)]">Resume / CV Versions</h4>
		<AutoSaveIndicator {field} />
	</div>
	<div class="flex flex-wrap items-center gap-1.5">
		{#each field.value as tag, i (i)}
			{@const isExclude = tag.startsWith('!')}
			<span
				class="inline-flex items-center rounded-md border px-2 py-1 text-xs {isExclude
					? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
					: 'border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'}"
			>
				{isExclude ? `hide from ${tag.slice(1)}` : tag}
			</span>
		{:else}
			<span class="text-sm text-[var(--dash-text-muted)] italic">All versions</span>
		{/each}
		<button
			type="button"
			onclick={() => (editing = true)}
			class="inline-flex items-center gap-1.5 px-2 py-1 text-sm text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
		>
			<FontAwesomeIcon icon={faTags} class="h-3 w-3" />
			Edit
		</button>
	</div>
</div>

{#if editing}
	<VersionTagsPopup
		title="Certificate versions"
		subtitle={name || undefined}
		tags={field.value}
		{versionSlugs}
		onChange={(next) => field.set(next)}
		onClose={() => (editing = false)}
	/>
{/if}
