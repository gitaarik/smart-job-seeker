<script lang="ts">
	/**
	 * Wraps {@link FilterPicker} with patch-on-save semantics for the edit
	 * page. Same pattern as {@link SourceEditor}: shows Cancel/Save when dirty,
	 * hides them otherwise, posts to /api/import-tasks/[id], invokes a
	 * callback so the parent can sync local state.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { SearchFilterValue } from '$lib/job-platforms/search-filters';
	import FilterPicker from './FilterPicker.svelte';

	interface Props {
		taskId: number;
		initial: Record<string, SearchFilterValue>;
		onSaved?: (saved: Record<string, SearchFilterValue>) => void;
	}

	let { taskId, initial, onSaved }: Props = $props();

	// Deep clone so the picker's mutations don't immediately flip "dirty".
	// `initial` is a Svelte 5 proxy when passed from a $state'd parent —
	// structuredClone() throws "Proxy object could not be cloned", so go
	// through JSON to detach into plain data.
	function detach(v: Record<string, SearchFilterValue>): Record<string, SearchFilterValue> {
		return JSON.parse(JSON.stringify(v));
	}

	let filters = $state<Record<string, SearchFilterValue>>(detach(initial));
	let savedSnapshot = $state(JSON.stringify(initial));
	let saving = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		// Reset on a fresh prop (e.g. parent forces re-mount with {#key}).
		filters = detach(initial);
		savedSnapshot = JSON.stringify(initial);
	});

	const dirty = $derived(JSON.stringify(filters) !== savedSnapshot);

	async function save() {
		saving = true;
		error = null;
		try {
			const res = await fetch(`/api/import-tasks/${taskId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ search_filters: filters })
			});
			if (!res.ok) {
				error = (await res.text()) || `HTTP ${res.status}`;
				return;
			}
			const snapshot = JSON.stringify(filters);
			savedSnapshot = snapshot;
			onSaved?.({ ...filters });
		} finally {
			saving = false;
		}
	}

	function cancel() {
		filters = JSON.parse(savedSnapshot) as Record<string, SearchFilterValue>;
		error = null;
	}
</script>

<div class="space-y-3">
	<FilterPicker bind:filters />

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
