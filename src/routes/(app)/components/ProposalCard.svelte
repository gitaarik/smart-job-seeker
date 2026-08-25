<script lang="ts" module>
	/** A pending (or applied) edit the assistant proposed. Shaped by the API. */
	export type Proposal = {
		/** agent_message_proposals row — one turn can carry several. */
		id: number;
		capability: string;
		title: string;
		rationale: string;
		target: { id: number; label: string };
		changes: { field: string; label: string; from: string; to: string }[];
		applied_at: string | null;
	};
</script>

<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowRight,
		faCheck,
		faPenToSquare,
		faTriangleExclamation
	} from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import ChangeDiff from '$lib/components/ChangeDiff.svelte';
	import DiffSegments from '$lib/components/DiffSegments.svelte';
	import { inlineDiff, shrinkage, summarizeValue } from '$lib/utils/change-analysis';

	/**
	 * The consent step between what the assistant suggests and what happens.
	 *
	 * Deliberately a diff rather than a list of new values: "Salary — $50/hour →
	 * $55/hour" is reviewable at a glance, where "salary_min: 55" asks the user to
	 * remember what it was. Long text (a rewritten description) is the one case
	 * that can't be shown inline; it gets a length summary and lands in the page's
	 * own editor once applied.
	 */
	let { proposal }: { proposal: Proposal } = $props();

	let applying = $state(false);
	let error = $state('');
	let appliedAt = $state<string | null>(proposal.applied_at);

	/**
	 * The one-line summary above is honest but not reviewable: "107 characters →
	 * 355 characters" tells you a rewrite happened, not whether you want it.
	 * Reading the thing you are being asked to approve is `ChangeDiff`, which the
	 * approvals page renders from the same analysis.
	 */

	async function apply() {
		if (applying || appliedAt) return;
		applying = true;
		error = '';
		try {
			const res = await fetch(`/api/ai/agent/proposals/${proposal.id}/apply`, { method: 'POST' });
			const data = await res.json().catch(() => null);
			if (!res.ok || !data?.success) {
				error = data?.message || 'Could not apply that change.';
				return;
			}
			appliedAt = new Date().toISOString();
			// The page behind the panel is now stale — it is very often the very
			// record that just changed.
			await invalidateAll();
		} catch {
			error = 'Could not reach the server. Please try again.';
		} finally {
			applying = false;
		}
	}
</script>

<div
	class="mt-2 overflow-hidden rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]"
>
	<div class="flex items-center gap-2 border-b border-[var(--dash-border)] px-3 py-2">
		<FontAwesomeIcon
			icon={appliedAt ? faCheck : faPenToSquare}
			class="h-3 w-3 shrink-0 {appliedAt
				? 'text-[var(--dash-success)]'
				: 'text-[var(--dash-primary)]'}"
		/>
		<span class="truncate text-xs font-medium text-[var(--dash-text)]">
			{proposal.title}
		</span>
		<span
			class="ml-auto max-w-[45%] shrink-0 truncate text-[11px] text-[var(--dash-text-muted)]"
			title={proposal.target.label}
		>
			{proposal.target.label}
		</span>
	</div>

	<div class="space-y-2 px-3 py-2">
		<!--
      The assistant's own account of the edit, and the first thing read. It
      used to sit at the bottom as a muted footnote, which was right when it
      was one sentence of justification and wrong now it carries the change
      itself — a rewritten description is a character count and a few excerpts
      otherwise, and this is the only part that says what it MEANS.

      Kept after applying, unlike before. An applied proposal is history, and
      the explanation is the most useful thing in it when reading back why a
      field holds what it holds.
    -->
		{#if proposal.rationale}
			<p class="text-xs leading-relaxed text-[var(--dash-text)]">
				{proposal.rationale}
			</p>
		{/if}

		{#if proposal.changes.length === 0}
			<p class="text-xs text-[var(--dash-text-muted)]">
				{appliedAt ? 'Applied.' : 'Nothing left to change — these values are already set.'}
			</p>
		{:else}
			<dl class="space-y-1.5">
				{#each proposal.changes as change (change.field)}
					{@const segments = inlineDiff(change)}
					<div class="text-xs">
						<dt class="text-[var(--dash-text-muted)]">{change.label}</dt>
						<dd class="flex items-start gap-1.5 text-[var(--dash-text)]">
							<!--
                No arrow when nothing is being replaced — a field that was
                unset, or a proposal that CREATES a row, where every `from` is
                "—" because there is no row yet. A struck-through "empty" with
                an arrow reads as something having been cleared.

                Applied proposals used to be suppressed here too: the transcript
                had no history for them, so `from` arrived as "—" and the arrow
                claimed a field had been empty when it had not. They now carry
                the before-image stored at apply time, so the arrow is correct
                and worth showing — an applied change without its old value is
                the half of the history you actually want later. Rows predating
                that column still have no `from`, and fall through to the same
                no-arrow branch on their own.
              -->
							{#if segments}
								<!-- A small edit, marked in place; see the approvals page for the why. -->
								<span class="break-words"><DiffSegments {segments} /></span>
							{:else}
								{#if change.from !== '—'}
									<span class="break-words text-[var(--dash-text-muted)] line-through">
										{summarizeValue(change.from)}
									</span>
									<FontAwesomeIcon
										icon={faArrowRight}
										class="mt-1 h-2.5 w-2.5 shrink-0 text-[var(--dash-text-muted)]"
									/>
								{/if}
								<span class="font-medium break-words">{summarizeValue(change.to)}</span>
							{/if}
							<!--
                Said here rather than left to be worked out from two character
                counts either side of an arrow. A replacement that is shorter
                than what it replaces is the one shape of edit whose loss is
                invisible: the new text reads perfectly well, and nothing about
                it says what used to be there.
              -->
							{#if shrinkage(change) > 0}
								<span class="mt-px shrink-0 text-[11px] text-amber-600 dark:text-amber-400">
									−{shrinkage(change).toLocaleString()}
								</span>
							{/if}
						</dd>
					</div>
				{/each}
			</dl>
		{/if}

		<ChangeDiff changes={proposal.changes} />

		{#if error}
			<p class="flex items-start gap-1.5 text-[11px] text-[var(--dash-error)]">
				<FontAwesomeIcon icon={faTriangleExclamation} class="mt-0.5 h-3 w-3 shrink-0" />
				{error}
			</p>
		{/if}
	</div>

	{#if proposal.changes.length > 0}
		<div class="border-t border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2">
			{#if appliedAt}
				<p class="flex items-center gap-1.5 text-[11px] text-[var(--dash-success)]">
					<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
					Applied
				</p>
			{:else}
				<button
					type="button"
					onclick={apply}
					disabled={applying}
					class="flex items-center gap-1.5 rounded-md bg-[var(--dash-primary)] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-60"
				>
					{#if applying}
						<Spinner size="w-3 h-3" />
					{:else}
						<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
					{/if}
					{applying ? 'Applying…' : 'Apply'}
				</button>
			{/if}
		</div>
	{/if}
</div>
