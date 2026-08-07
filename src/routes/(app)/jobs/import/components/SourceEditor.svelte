<script lang="ts">
	/**
	 * Minimal keywords editor for the edit-task page.
	 *
	 * After the URL-template flow was removed, the only thing left to edit on
	 * the "search source" side is the keywords string the scraper types into
	 * the platform's search input. Filters live on a separate (existing) row
	 * of the form; URL/preset/location have all been retired.
	 *
	 * Patch-on-save pattern: shows Cancel/Save when the field is dirty, hides
	 * them otherwise, posts a PATCH to the existing /api/import-tasks/[id]
	 * endpoint, and calls back so the parent can sync its local copy.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';

	interface Props {
		taskId: number;
		initial: {
			platform_id: number | null;
			search_term: string | null;
			search_filters: Record<string, string | string[]>;
		};
		onSaved?: (saved: {
			platform_id: number | null;
			search_term: string | null;
			search_filters: Record<string, string | string[]>;
		}) => void;
	}

	let { taskId, initial, onSaved }: Props = $props();

	let keywords = $state(initial.search_term ?? '');
	let savedKeywords = $state(initial.search_term ?? '');
	let saving = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		// Reset on prop change (e.g. after a successful save with a {#key} reset)
		keywords = initial.search_term ?? '';
		savedKeywords = initial.search_term ?? '';
	});

	const dirty = $derived(keywords.trim() !== (savedKeywords ?? '').trim());

	async function save() {
		const trimmed = keywords.trim();
		saving = true;
		error = null;
		try {
			const res = await fetch(`/api/import-tasks/${taskId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ search_term: trimmed || null })
			});
			if (!res.ok) {
				error = (await res.text()) || `HTTP ${res.status}`;
				return;
			}
			savedKeywords = trimmed;
			onSaved?.({
				platform_id: initial.platform_id,
				search_term: trimmed || null,
				search_filters: initial.search_filters
			});
		} finally {
			saving = false;
		}
	}

	function cancel() {
		keywords = savedKeywords;
		error = null;
	}
</script>

<div class="space-y-2">
	<div>
		<label
			class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
			for="edit-keywords-{taskId}"
			>Search keywords <span class="font-normal text-[var(--dash-text-muted)]">(optional)</span
			></label
		>
		<input
			id="edit-keywords-{taskId}"
			type="text"
			bind:value={keywords}
			placeholder="e.g. python developer, react senior, devops"
			disabled={saving}
			class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-sm text-[var(--dash-text)] disabled:opacity-60"
		/>
		<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
			Typed into the platform's search input at scrape time. Plain text — no URL encoding.
		</p>
	</div>

	{#if error}
		<p class="text-xs text-red-600 dark:text-red-400">{error}</p>
	{/if}

	{#if dirty}
		<div class="flex justify-end gap-2">
			<button
				type="button"
				onclick={cancel}
				disabled={saving}
				class="inline-flex items-center gap-1.5 rounded border border-[var(--dash-border)] px-3 py-1 text-xs text-[var(--dash-text)] hover:bg-[var(--dash-bg)] disabled:opacity-50"
			>
				<FontAwesomeIcon icon={faXmark} class="h-3 w-3" />
				Cancel
			</button>
			<button
				type="button"
				onclick={save}
				disabled={saving}
				class="inline-flex items-center gap-1.5 rounded bg-[var(--dash-primary)] px-3 py-1 text-xs text-white hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
			>
				{#if saving}
					<Spinner size="w-3 h-3" />
				{:else}
					<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
				{/if}
				Save
			</button>
		</div>
	{/if}
</div>
