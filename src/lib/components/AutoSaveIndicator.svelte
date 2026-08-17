<script lang="ts">
	/**
	 * Inline status pill for {@link autoSaveField}, or for anything else shaped
	 * like a {@link SaveStatus} — a whole section's rows, say. A spinner while
	 * saving, a "Saved · Undo" pill for a few seconds after a successful save,
	 * and an error message with a Retry button on failure. Sits next to the input
	 * it belongs to — no toast.
	 *
	 * Idle renders nothing by default, which is right beside a field the user is
	 * looking at and wrong on a page that has just stopped having Save buttons:
	 * there, silence is the same as "this does not save". `idleLabel` is for
	 * that — a standing statement that the thing saves itself, replaced by the
	 * live status the moment there is one.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck, faExclamationTriangle, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { SaveStatus } from './auto-save.svelte';

	interface Props {
		field: SaveStatus;
		/** Optional label override for the Saved pill (e.g. "Updated"). */
		savedLabel?: string;
		/**
		 * Shown when nothing is happening. Omit where the surrounding UI already
		 * says the field saves itself, or where a resting label would be noise.
		 */
		idleLabel?: string;
	}

	let { field, savedLabel = 'Saved', idleLabel }: Props = $props();
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
	{:else if idleLabel}
		<span class="text-[var(--dash-text-muted)]">{idleLabel}</span>
	{/if}
</span>
