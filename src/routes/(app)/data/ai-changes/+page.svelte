<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck, faHistory, faRotateLeft, faXmark } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import ChangeDiff from '$lib/components/ChangeDiff.svelte';
	import DiffSegments from '$lib/components/DiffSegments.svelte';
	import {
		inlineDiff,
		shrinkage,
		summarizeValue,
		type FieldChange
	} from '$lib/utils/change-analysis';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** Which surface made the change, in words rather than a column value. */
	const SOURCE_LABELS: Record<string, string> = {
		chat: 'the assistant',
		mcp: 'a connected app',
		ui: 'you'
	};

	function when(date: Date | string): string {
		return new Date(date).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}
</script>

<svelte:head>
	<title>Recent Changes - Smart Job Seeker</title>
</svelte:head>

<!--
	What one change did, as its fields. Rendered for a pending request and for a
	history entry from the same definition: they are the same list of the same
	shape, and the two copies this replaced had already drifted from the chat's
	proposal card — see the `from` branch below for the drift that was visible.
-->
{#snippet changeList(changes: FieldChange[])}
	<dl class="mt-3 space-y-2 text-sm">
		{#each changes as change (change.field)}
			{@const segments = inlineDiff(change)}
			<div>
				<dt class="text-[var(--dash-text-secondary)]">{change.label}</dt>
				<dd class="break-words">
					<!--
						A small edit reads as a diff: the word that changed is marked, instead of
						left for the eye to find between two near-identical lines. A rewrite, a
						value being set or cleared, and anything long fall back to old → new — the
						long ones get their full diff from ChangeDiff below.
					-->
					{#if segments}
						<DiffSegments {segments} />
					{:else}
						<!--
							No arrow when nothing is being replaced. An add creates a row, so every
							`from` arrives as "—", and "empty → Smart Job Seeker" reads as a field
							that used to hold something and was cleared — on the row's own parent,
							where it reads as the project itself having been emptied. What the add
							is saying is just "Side project: Smart Job Seeker". Same branch as the
							chat's ProposalCard, which has had it since it started showing creates.
						-->
						{#if change.from !== '—'}
							<span class="line-through opacity-60">{summarizeValue(change.from)}</span>
							<span aria-hidden="true"> → </span>
						{/if}
						<span>{summarizeValue(change.to)}</span>
					{/if}
					<!--
						A replacement shorter than what it replaces is the one shape of edit whose
						loss is invisible — the new text reads perfectly well, and nothing about it
						says what used to be there.
					-->
					{#if shrinkage(change) > 0}
						<span class="text-[11px] text-amber-600 dark:text-amber-400">
							−{shrinkage(change).toLocaleString()}
						</span>
					{/if}
				</dd>
			</div>
		{/each}
	</dl>
	<div class="mt-2">
		<ChangeDiff {changes} />
	</div>
{/snippet}

<div class="space-y-6">
	<SectionHeader title="Recent Changes" icon={faHistory} />

	<p class="text-[var(--dash-text-secondary)]">
		Every change made to your data — by you, by the assistant, or by a connected app — newest first,
		with what it replaced. Undo puts the old value back exactly as it was, which also means it
		overwrites anything changed since.
	</p>

	{#if form?.error}
		<p
			class="rounded-lg border p-3 text-sm"
			style="background-color: var(--dash-error-light); border-color: var(--dash-error); color: var(--dash-error);"
		>
			{form.error}
		</p>
	{/if}

	{#if data.pending.length > 0}
		<!--
			Waiting on a decision, above the history. A connected app asked for
			something it is not allowed to do on its own — overwriting text you
			wrote, or taking an entry off your documents — and nothing happens
			until you say so here.
		-->
		<section class="space-y-4">
			<h2 class="text-lg font-semibold">Waiting for you</h2>
			<ul class="space-y-4">
				{#each data.pending as request (request.id)}
					<li
						id="request-{request.id}"
						class="rounded-lg border p-4"
						style="border-color: var(--dash-warning, var(--dash-border));"
					>
						<div class="flex flex-wrap items-baseline justify-between gap-2">
							<div>
								<h3 class="font-semibold">{request.title}</h3>
								<p class="text-sm text-[var(--dash-text-secondary)]">
									<!-- `request_id`, as the agent's own unapplied result reports it. -->
									<span class="font-mono">Request {request.id}</span> ·
									{request.target.label} · asked {when(request.createdAt)} · by a connected app
								</p>
							</div>

							<div class="flex gap-2">
								<form method="POST" action="?/approve" use:enhance>
									<input type="hidden" name="id" value={request.id} />
									<button
										type="submit"
										class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-white"
										style="background-color: var(--dash-primary);"
									>
										<FontAwesomeIcon icon={faCheck} class="h-3.5 w-3.5" />
										Apply
									</button>
								</form>
								<form method="POST" action="?/reject" use:enhance>
									<input type="hidden" name="id" value={request.id} />
									<button
										type="submit"
										class="flex items-center gap-2 rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm hover:bg-[var(--dash-surface-hover)]"
									>
										<FontAwesomeIcon icon={faXmark} class="h-3.5 w-3.5" />
										Discard
									</button>
								</form>
							</div>
						</div>

						{#if request.rationale}
							<!--
								The app's own account of why, quoted as text. It was written
								outside this application by a model that may have been reading a
								document a stranger wrote, so it is shown as a claim and never
								as instructions or markup.
							-->
							<p class="mt-3 text-sm text-[var(--dash-text-secondary)] italic">
								“{request.rationale}”
							</p>
						{/if}

						{#if request.changes.length > 0}
							{@render changeList(request.changes)}
						{:else if request.whereInstead}
							<p class="mt-3 text-sm text-[var(--dash-text-secondary)]">
								This would take the entry off your CVs and exports. It stays on your
								{request.whereInstead} page, and you can put it back there.
							</p>
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		<h2 class="text-lg font-semibold">History</h2>
	{/if}

	{#if data.entries.length === 0}
		<p class="rounded-lg border border-[var(--dash-border)] p-6 text-[var(--dash-text-secondary)]">
			Nothing yet. Every edit you make, and every change you accept from the assistant, is recorded
			here.
		</p>
	{:else}
		<ul class="space-y-4">
			{#each data.entries as entry (entry.id)}
				<!--
					Anchored like a pending request, so one of these can be linked to as
					well as named. The two ids are different things — a request is an
					unanswered proposal, a change is something that happened — which is
					why they are labelled rather than printed bare, and why they do not
					share a prefix.
				-->
				<li id="change-{entry.id}" class="rounded-lg border border-[var(--dash-border)] p-4">
					<div class="flex flex-wrap items-baseline justify-between gap-2">
						<div>
							<h3 class="font-semibold">{entry.title}</h3>
							<p class="text-sm text-[var(--dash-text-secondary)]">
								<!--
									What an agent calls this when it reports one back: `change_id`
									in the applied result, `request_id` in the tier 2 one. Shown so
									that "change 1116" in a chat and a row on this page are visibly
									the same thing, which is the whole reason it is here.
								-->
								<span class="font-mono">Change {entry.id}</span>
								<!--
									And the number it was approved under, where it was approved at
									all. The two run on separate sequences, so a change and a
									request whose numbers are close are not related — change 1110
									really did come from request 110, and change 1111 came from no
									request at all. Printing only one of them is what made that
									pair unreadable.
								-->
								{#if entry.fromRequest}
									<span class="font-mono">· from Request {entry.fromRequest}</span>
								{/if} ·
								<!--
									The name of the thing is where you would click to go and look at
									it, so it is the link rather than a second one beside it. Absent
									for a change whose target has no page at all, which is why this
									branches instead of always linking.

									The path comes from the log and never from the URL: `entities.ts`
									built it, out of ids this profile owns. Not `resolve()` — it is
									overloaded per literal route, so a route id in a variable
									satisfies no overload, and the paths here span four route trees.
								-->
								{#if entry.link}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
									<a class="underline hover:no-underline" href={entry.link.path}>
										{entry.target.label}
									</a>
								{:else}
									{entry.target.label}
								{/if}
								· {when(entry.createdAt)} · by {SOURCE_LABELS[entry.source] ?? entry.source}
							</p>
						</div>

						{#if entry.revertedAt}
							<span class="text-sm text-[var(--dash-text-secondary)]">
								Undone {when(entry.revertedAt)}
							</span>
						{:else if entry.blockedBy}
							<!--
								Undoable, but not yet. A later change wrote the same fields of the
								same row, so this before-image is no longer the inverse of its own
								write — putting it back would discard the later change and leave a
								value nobody chose. Undo runs newest-first, which is the order this
								list is already in.
							-->
							<span class="text-sm text-[var(--dash-text-secondary)]">
								Undo “{entry.blockedBy}” above first
							</span>
						{:else if entry.revertible}
							<form method="POST" action="?/revert" use:enhance>
								<input type="hidden" name="id" value={entry.id} />
								<button
									type="submit"
									class="flex items-center gap-2 rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm hover:bg-[var(--dash-surface-hover)]"
								>
									<FontAwesomeIcon icon={faRotateLeft} class="h-3.5 w-3.5" />
									Undo
								</button>
							</form>
						{:else if entry.applicantNote}
							<!--
								The capability's own account of what it left behind, for the
								cases where naming a page is a poor description of it. A version
								add is the one that motivated this: it changes nothing anybody
								reads and leaves a version in a timeline awaiting a verdict,
								which "change it on your Interview Prep page" reads as a dead end
								rather than as the decision it is.

								Ahead of `whereInstead` rather than beside it, because the note
								names the page too and the two together say it twice.
							-->
							<span class="text-sm text-[var(--dash-text-secondary)]">
								{entry.applicantNote}
							</span>
						{:else if entry.whereInstead}
							<!--
								No undo for this one: the verb has no reverse through the
								registry, so the honest answer is where to do it by hand, the
								same shape as the assistant naming a page it cannot reach. A
								profile add reverses by removing the row it made and reaches the
								Undo branch above instead; what lands here is the verbs that
								cannot, and that have nothing more particular to say.

								Named rather than linked. `resolve()` is overloaded per literal
								route, so a route id held in a variable satisfies no overload, and
								the only way to link would be a second copy of the section-to-route
								table beside the declaration that exists to prevent exactly that.
								The section is one click away in the sidebar.
							-->
							<span class="text-sm text-[var(--dash-text-secondary)]">
								Change it on your {entry.whereInstead} page
							</span>
						{/if}
					</div>

					{#if entry.changes.length > 0}
						{@render changeList(entry.changes)}
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
