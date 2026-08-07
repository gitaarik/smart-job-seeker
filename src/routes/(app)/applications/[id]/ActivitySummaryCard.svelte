<script lang="ts">
	/**
	 * The standing summary of this application's activity entries.
	 *
	 * The entries themselves live on their own tab, so the overview page — the
	 * one someone opens to remember what is going on — has had no window onto
	 * them at all: it shows status, job details, notes and the status log, none
	 * of which say what was actually said. The summary has been in the database
	 * since the comparison spine shipped, written for the assistant's prompt and
	 * never shown to anyone.
	 *
	 * It self-hides rather than being gated by the parent, because the rule for
	 * *whether* to appear and the rule for *what an empty one means* are the same
	 * rule and would drift if they were written in two places.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCompass, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
	import Card from '../../components/Card.svelte';
	import { MIN_ENTRIES_FOR_SUMMARY } from '$lib/application-records';
	import { timeAgo } from '$lib/format';

	let {
		summary,
		updatedAt,
		entryCount,
		activityHref
	}: {
		summary: string | null;
		updatedAt: Date | string | null;
		/** Entries carrying content — the same ones the summariser counts. */
		entryCount: number;
		activityHref: string;
	} = $props();

	/**
	 * Below the threshold, no summary is the rule working: there is nothing to
	 * condense that the entries do not already say. At or above it, an absent
	 * summary means nobody has looked — a failed generation, or an application
	 * dormant since before the feature existed — and staying silent about that
	 * would read as "nothing has happened here", which is the opposite of true.
	 */
	let expected = $derived(entryCount >= MIN_ENTRIES_FOR_SUMMARY);
</script>

{#if summary || expected}
	<Card padding="lg">
		<div class="space-y-3">
			<div class="flex items-center gap-2">
				<FontAwesomeIcon icon={faCompass} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
				<h2 class="text-sm font-semibold tracking-wide text-[var(--dash-text)] uppercase">
					Where this stands
				</h2>
			</div>

			{#if summary}
				<p class="text-sm leading-relaxed whitespace-pre-wrap text-[var(--dash-text)]">
					{summary}
				</p>

				<p class="flex flex-wrap items-center gap-1.5 text-xs text-[var(--dash-text-muted)]">
					<FontAwesomeIcon icon={faWandMagicSparkles} class="h-3 w-3" />
					<span>
						Written from your
						<a
							href={activityHref}
							class="underline transition-colors hover:text-[var(--dash-primary)]"
							>{entryCount} activity {entryCount === 1 ? 'entry' : 'entries'}</a
						>{#if updatedAt}<span>, {timeAgo(updatedAt)}</span>{/if}
					</span>
				</p>
			{:else}
				<p class="text-sm text-[var(--dash-text-muted)]">
					Not written yet. It is rewritten whenever an
					<a
						href={activityHref}
						class="underline transition-colors hover:text-[var(--dash-primary)]">activity entry</a
					> changes, so adding or editing one will produce it.
				</p>
			{/if}
		</div>
	</Card>
{/if}
