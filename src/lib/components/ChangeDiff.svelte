<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
	import { analyseChanges, asText, isLong, type FieldChange } from '$lib/utils/change-analysis';
	import DiffSegments from './DiffSegments.svelte';

	/**
	 * The full text behind a change, on demand, as a diff where that reads.
	 *
	 * A one-line "Description: 5,204 characters → 4,830 characters" is honest and
	 * tells you nothing about whether you want it. This is the part that answers
	 * that, and it is a component rather than a snippet because the two surfaces
	 * that need it — the chat's proposal card and the approvals page — are the
	 * two ends of the same decision, and they were drifting: one had the diff,
	 * the dropped-run panel and a length warning, the other had `old → new` with
	 * a line through the old.
	 *
	 * This is the long-value half. A short value is read where it is listed:
	 * the same surfaces render `inlineDiff` through the same `DiffSegments`, so
	 * a one-word correction is marked in place instead of left for the eye to
	 * find between two near-identical lines.
	 *
	 * Owns its own expanded state. The toggle and the panel belong together, and
	 * a parent holding the flag only to pass it back down is a prop that exists
	 * to be forgotten.
	 */
	let {
		changes,
		labelPrefix = ''
	}: {
		changes: FieldChange[];
		/** Prepended to each field label, for a surface that lists several rows. */
		labelPrefix?: string;
	} = $props();

	let expanded = $state(false);

	const longChanges = $derived(changes.filter(isLong));

	// Only while expanded, and only the long ones: see `analyseChanges`. A page
	// showing thirty pending requests would otherwise run a quadratic diff for
	// every one of them before the user has asked to read any.
	const analysed = $derived(expanded ? analyseChanges(longChanges) : []);
</script>

{#if longChanges.length > 0}
	<button
		type="button"
		onclick={() => (expanded = !expanded)}
		class="flex items-center gap-1 text-[11px] text-[var(--dash-primary)] hover:underline"
	>
		<FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown} class="h-2.5 w-2.5" />
		{expanded ? 'Hide full text' : 'View full text'}
	</button>
{/if}

{#if expanded}
	<div class="space-y-2">
		{#each analysed as { change, segments, dropped } (change.field)}
			<div>
				<p class="mb-0.5 text-[11px] text-[var(--dash-text-muted)]">
					{labelPrefix}{change.label}
					{#if !segments}
						<span class="italic">— replaced, showing the new text</span>
					{/if}
				</p>
				<div
					class="max-h-64 overflow-y-auto rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5"
				>
					{#if segments}
						<pre
							class="text-[11px] leading-relaxed break-words whitespace-pre-wrap text-[var(--dash-text)]"><DiffSegments
								{segments}
							/></pre>
					{:else}
						<pre
							class="text-[11px] leading-relaxed break-words whitespace-pre-wrap text-[var(--dash-text)]">{asText(
								change.to
							) || '(empty)'}</pre>
					{/if}
				</div>

				<!--
          Only on the rewrite branch: a small diff already shows its removals
          inline, in place, which is better than a list of them.
        -->
				{#if !segments && dropped.length > 0}
					<p class="mt-1 mb-0.5 text-[11px] text-amber-600 dark:text-amber-400">
						In the old text and not in the new one
					</p>
					<div
						class="max-h-40 space-y-1 overflow-y-auto rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5"
					>
						{#each dropped as run, i (i)}
							<pre
								class="text-[11px] leading-relaxed break-words whitespace-pre-wrap text-[var(--dash-text-muted)]">{run}</pre>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}
