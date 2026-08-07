<script lang="ts" generics="T">
	/**
	 * Inline status pill for {@link autoSaveField}. Renders nothing when idle
	 * (no recent activity), a spinner while saving, a "Saved · Undo" pill for a
	 * few seconds after a successful save, and an error message with a Retry
	 * button on failure. Sits next to the input it belongs to — no toast.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck, faExclamationTriangle, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { AutoSaveField } from './auto-save.svelte';

	interface Props {
		field: AutoSaveField<T>;
		/** Optional label override for the Saved pill (e.g. "Updated"). */
		savedLabel?: string;
	}

	let { field, savedLabel = 'Saved' }: Props = $props();
</script>

<span class="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
	{#if field.status === 'saving'}
		<Spinner size="w-3 h-3" color="var(--dash-text-muted)" />
		<span class="text-[var(--dash-text-muted)]">Saving…</span>
	{:else if field.status === 'saved'}
		<FontAwesomeIcon icon={faCheck} class="h-3 w-3 text-[var(--dash-success)]" />
		<span class="text-[var(--dash-text-muted)]">{savedLabel}</span>
		{#if field.canUndo}
			<span class="text-[var(--dash-text-muted)]">·</span>
			<button
				type="button"
				onclick={field.undo}
				class="inline-flex items-center gap-1 text-[var(--dash-primary)] hover:underline"
			>
				<FontAwesomeIcon icon={faRotateLeft} class="h-2.5 w-2.5" />
				Undo
			</button>
		{/if}
	{:else if field.status === 'error'}
		<FontAwesomeIcon icon={faExclamationTriangle} class="h-3 w-3 text-[var(--dash-error)]" />
		<span class="text-[var(--dash-error)]">{field.error ?? 'Save failed'}</span>
		<button
			type="button"
			onclick={field.retry}
			class="ml-1 text-[var(--dash-primary)] hover:underline"
		>
			Retry
		</button>
	{/if}
</span>
