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
		faChevronDown,
		faChevronUp,
		faPenToSquare,
		faTriangleExclamation
	} from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import { computeDiff, isSmallDiff } from '$lib/utils/word-diff';

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

	/** Values too long to sit in a chat panel — show the shape, not the blob. */
	const LONG_VALUE_CHARS = 120;

	function summarize(value: string): string {
		if (value === '—') return 'empty';
		if (value.length <= LONG_VALUE_CHARS) return value;
		return `${value.length.toLocaleString()} characters`;
	}

	/**
	 * The summary above is honest but not reviewable: "107 characters → 355
	 * characters" tells you a rewrite happened, not whether you want it. This is
	 * the way to read the thing you are being asked to approve.
	 */
	let expanded = $state(false);

	/** Rows whose real content the summary hid. Short ones are already visible. */
	function isLong(change: { from: string; to: string }): boolean {
		return change.from.length > LONG_VALUE_CHARS || change.to.length > LONG_VALUE_CHARS;
	}

	const longChanges = $derived(proposal.changes.filter(isLong));

	/** "—" is how an unset value is rendered; as diff input it means empty. */
	const asText = (value: string) => (value === '—' ? '' : value);

	/**
	 * How short a removed run has to be before it counts as rewording rather
	 * than a cut.
	 *
	 * Chosen, not guessed, but on a thin corpus: every stored rewrite proposal
	 * yields 7.5 runs per card at 40 characters, 4.0 at 80 and 2.5 at 120, and
	 * the paragraph this was built to catch survives all three. Length is a
	 * weak discriminator — a rewritten region comes back as a removed run too,
	 * and some of those run past 100 characters — so the panel is labelled as
	 * what it literally is rather than as "what you lost". 80 halves the churn
	 * without reaching the length of a dropped sentence.
	 */
	const DROPPED_RUN_CHARS = 80;

	/**
	 * Each long change, diffed once, with what a rewrite dropped pulled out.
	 *
	 * A tweak gets the word diff inline — same threshold the version editors
	 * use, because diffing two texts that share almost nothing produces an
	 * unreadable stripe of every word deleted and every word added, which hides
	 * the very thing the user opened this to read.
	 *
	 * A wholesale rewrite got only the new text, and that is the hole this
	 * fills. Asked to combine a job posting with a second one the user pasted
	 * into the chat, the assistant returned a merge 950 characters SHORTER than
	 * the description it replaced — and because a merge changes far more than
	 * 30% of the words, the card showed the new text with nothing to say a whole
	 * paragraph of the old one had gone. No prompt makes an LLM rewrite
	 * lossless; what it can do is not be silent about it. `dropped` is the runs
	 * of the old text with no counterpart in the new one, which is that
	 * paragraph and not the rewording around it.
	 *
	 * Computed only while expanded: the LCS is quadratic in words, and a thread
	 * with a dozen cards would run it a dozen times over two 4,000-character
	 * texts to render nothing.
	 */
	const analysed = $derived(
		(expanded ? longChanges : []).map((change) => {
			const segments = computeDiff(asText(change.from), asText(change.to));
			return {
				change,
				segments: isSmallDiff(segments) ? segments : null,
				dropped: segments
					.filter((s) => s.type === 'removed' && s.text.trim().length >= DROPPED_RUN_CHARS)
					.map((s) => s.text.trim())
			};
		})
	);

	/** How much shorter the replacement is, when it is materially shorter. */
	function shrinkage(change: { from: string; to: string }): number {
		if (!isLong(change) || change.from === '—') return 0;
		return Math.max(0, change.from.length - change.to.length);
	}

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
				{#each proposal.changes as change}
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
							{#if change.from !== '—'}
								<span class="break-words text-[var(--dash-text-muted)] line-through">
									{summarize(change.from)}
								</span>
								<FontAwesomeIcon
									icon={faArrowRight}
									class="mt-1 h-2.5 w-2.5 shrink-0 text-[var(--dash-text-muted)]"
								/>
							{/if}
							<span class="font-medium break-words">{summarize(change.to)}</span>
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
							{change.label}
							{#if !segments}
								<span class="italic">— replaced, showing the new text</span>
							{/if}
						</p>
						<div
							class="max-h-64 overflow-y-auto rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5"
						>
							{#if segments}
								<pre
									class="text-[11px] leading-relaxed break-words whitespace-pre-wrap text-[var(--dash-text)]">{#each segments as seg}{#if seg.type === 'added'}<span
												class="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
												>{seg.text}</span
											>{:else if seg.type === 'removed'}<span
												class="bg-red-500/20 text-red-700 line-through dark:text-red-300"
												>{seg.text}</span
											>{:else}{seg.text}{/if}{/each}</pre>
							{:else}
								<pre
									class="text-[11px] leading-relaxed break-words whitespace-pre-wrap text-[var(--dash-text)]">{asText(
										change.to
									) || '(empty)'}</pre>
							{/if}
						</div>

						<!--
              Only on the rewrite branch: a small diff already shows its
              removals inline, in place, which is better than a list of them.
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
