<script lang="ts">
	/*
	 * activityHref is a prop, resolved by the page that owns the application id.
	 * This component only renders what it is handed, so the rule has nothing
	 * to check.
	 */
	/**
	 * The facts picked out of this application's activity entries, grouped by
	 * kind, and the two ways to put something back in: a note, and a correction.
	 *
	 * The entries themselves are long and on another tab; the summary is three to
	 * six sentences about where things stand. Neither can hold "two mandatory
	 * office days" or "they'll send the take-home Monday" — the first buries it,
	 * the second would become a list instead of a position. This is the shelf
	 * those go on.
	 *
	 * Each row links back to the entry it came from where the model named one
	 * that exists, because a fact stated on the overview page reads as the app
	 * asserting it, and the cheapest form of trust is being able to go and look.
	 *
	 * ## Why a correction is a note and not an edit
	 *
	 * The facts are rebuilt from the entries every time one changes, which is what
	 * keeps a renegotiated figure from living on beside the one that replaced it.
	 * A fact edited in place would last until the next entry and then silently
	 * revert. So "not right?" writes what is right as a note on the timeline, the
	 * rebuild that follows reads it, and the corrected fact has a source like
	 * every other one. The note box at the bottom works the same way, which is
	 * the point of it: a note here reaches the facts, the assistant and the
	 * letters, where the old Notes list reached none of them.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faListCheck, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
	import { enhance } from '$app/forms';
	import Card from '../../components/Card.svelte';
	import { groupDetails, type StoredDetail } from '$lib/application-details';
	import { summaryIsWorthWriting } from '$lib/application-records';
	import { timeAgo } from '$lib/format';

	let {
		details,
		updatedAt,
		entryLengths,
		activityHref
	}: {
		details: StoredDetail[];
		updatedAt: Date | string | null;
		/** The length of each entry's text; decides what an empty card says. */
		entryLengths: number[];
		activityHref: string;
	} = $props();

	let groups = $derived(groupDetails(details ?? []));
	let entryCount = $derived(entryLengths.filter((n) => n > 0).length);
	let expected = $derived(summaryIsWorthWriting(entryLengths));

	const keyOf = (item: StoredDetail) => `${item.category}:${item.label}`;

	let correcting = $state<string | null>(null);
	let correction = $state('');
	let savingCorrection = $state(false);

	let note = $state('');
	let savingNote = $state(false);

	function autoResize(el: HTMLTextAreaElement) {
		el.style.height = 'auto';
		el.style.height = el.scrollHeight + 'px';
	}
</script>

<Card padding="lg">
	<div class="space-y-4">
		<div class="flex items-center gap-2">
			<FontAwesomeIcon icon={faListCheck} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
			<h2 class="text-sm font-semibold tracking-wide text-[var(--dash-text)] uppercase">
				Key facts
			</h2>
		</div>

		{#if groups.length > 0}
			{#each groups as group (group.category)}
				<div class="space-y-1.5">
					<p class="text-xs font-medium tracking-wide text-[var(--dash-text-muted)] uppercase">
						{group.label}
					</p>
					<ul class="space-y-1.5">
						{#each group.items as item (item.label)}
							<li class="group text-sm leading-relaxed">
								<span class="font-medium text-[var(--dash-text)]">{item.label}:</span>
								<span class="text-[var(--dash-text-secondary)]">{item.value}</span>
								{#if item.record_id != null}
									<!-- eslint-disable svelte/no-navigation-without-resolve -->
									<a
										href="{activityHref}#r{item.record_id}"
										class="ml-1 text-xs whitespace-nowrap text-[var(--dash-text-muted)] underline transition-colors hover:text-[var(--dash-primary)]"
										title="The entry this came from">source</a
									>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
								{/if}
								{#if correcting !== keyOf(item)}
									<button
										type="button"
										onclick={() => {
											correcting = keyOf(item);
											correction = '';
										}}
										class="ml-1 text-xs whitespace-nowrap text-[var(--dash-text-muted)] underline opacity-60 transition-opacity group-hover:opacity-100 hover:text-[var(--dash-primary)] focus:opacity-100"
										>not right?</button
									>
								{:else}
									<form
										method="POST"
										action="?/correctFact"
										class="mt-1.5 flex items-start gap-2"
										use:enhance={() => {
											savingCorrection = true;
											return async ({ update }) => {
												await update();
												savingCorrection = false;
												correcting = null;
												correction = '';
											};
										}}
									>
										<input type="hidden" name="label" value={item.label} />
										<input type="hidden" name="value" value={item.value} />
										<textarea
											name="text"
											bind:value={correction}
											oninput={(e) => autoResize(e.currentTarget)}
											onkeydown={(e) => {
												if (e.key === 'Escape') correcting = null;
												else if (e.key === 'Enter' && !e.shiftKey) {
													e.preventDefault();
													if (correction.trim()) e.currentTarget.form?.requestSubmit();
												}
											}}
											rows={1}
											placeholder="What is right?"
											aria-label="The correct version of {item.label}"
											disabled={savingCorrection}
											class="flex-1 resize-none overflow-hidden rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-sm text-[var(--dash-text)] focus:border-[var(--dash-primary)] focus:outline-none"
										></textarea>
										<button
											type="submit"
											disabled={!correction.trim() || savingCorrection}
											class="rounded-md border border-[var(--dash-border)] px-2.5 py-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)] disabled:opacity-40"
										>
											{savingCorrection ? 'Saving…' : 'Save'}
										</button>
										<button
											type="button"
											onclick={() => (correcting = null)}
											disabled={savingCorrection}
											class="px-1 py-1.5 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)]"
										>
											Cancel
										</button>
									</form>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/each}

			<p class="flex flex-wrap items-center gap-1.5 text-xs text-[var(--dash-text-muted)]">
				<FontAwesomeIcon icon={faWandMagicSparkles} class="h-3 w-3" />
				<span>
					Picked out of your
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={activityHref}
						class="underline transition-colors hover:text-[var(--dash-primary)]"
						>{entryCount} activity {entryCount === 1 ? 'entry' : 'entries'}</a
					>{#if updatedAt}<span> {timeAgo(updatedAt)}</span>{/if}.
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					Rebuilt whenever one changes.
				</span>
			</p>
		{:else}
			<p class="text-sm text-[var(--dash-text-muted)]">
				{#if entryCount === 0}
					Facts are picked out of what you add to
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={activityHref}
						class="underline transition-colors hover:text-[var(--dash-primary)]">Activity</a
					><!-- eslint-enable svelte/no-navigation-without-resolve -->: a pasted email, an uploaded
					transcript or contract, a note. Nothing there yet.
				{:else if !expected}
					Your one entry is short enough to read as it is. Facts are picked out once there is more,
					or a longer entry.
				{:else if updatedAt}
					Nothing specific picked out of your {entryCount} activity
					{entryCount === 1 ? 'entry' : 'entries'} yet.
				{:else}
					Not picked out yet. It runs whenever an activity entry is added or changed.
				{/if}
			</p>
		{/if}

		<form
			method="POST"
			action="?/addNote"
			class="space-y-1.5 border-t border-[var(--dash-border)] pt-3"
			use:enhance={() => {
				savingNote = true;
				return async ({ update }) => {
					await update();
					savingNote = false;
					note = '';
				};
			}}
		>
			<div class="flex items-start gap-2">
				<textarea
					name="text"
					bind:value={note}
					oninput={(e) => autoResize(e.currentTarget)}
					onkeydown={(e) => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							if (note.trim()) e.currentTarget.form?.requestSubmit();
						}
					}}
					rows={1}
					placeholder="Add a note: something you heard, decided or want to remember"
					aria-label="Add a note"
					disabled={savingNote}
					class="flex-1 resize-none overflow-hidden rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-sm text-[var(--dash-text)] focus:border-[var(--dash-primary)] focus:outline-none"
				></textarea>
				<button
					type="submit"
					disabled={!note.trim() || savingNote}
					class="rounded-md border border-[var(--dash-border)] px-2.5 py-2 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)] disabled:opacity-40"
				>
					{savingNote ? 'Saving…' : 'Add'}
				</button>
			</div>
			<p class="text-xs text-[var(--dash-text-muted)]">
				{savingNote || savingCorrection
					? 'Saving to Activity and re-reading your entries…'
					: 'Saved to Activity as a note, where it feeds these facts, the assistant and your letters.'}
			</p>
		</form>
	</div>
</Card>
