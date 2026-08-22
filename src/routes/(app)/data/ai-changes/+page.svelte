<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck, faHistory, faRotateLeft, faXmark } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import ChangeDiff from '$lib/components/ChangeDiff.svelte';
	import { shrinkage, summarizeValue } from '$lib/utils/change-analysis';

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
							<dl class="mt-3 space-y-2 text-sm">
								{#each request.changes as change (change.field)}
									<div>
										<dt class="text-[var(--dash-text-secondary)]">{change.label}</dt>
										<dd class="break-words">
											<span class="line-through opacity-60">{summarizeValue(change.from)}</span>
											<span aria-hidden="true"> → </span>
											<span>{summarizeValue(change.to)}</span>
											<!--
												A replacement shorter than what it replaces is the one shape of
												edit whose loss is invisible — the new text reads perfectly well,
												and nothing about it says what used to be there.
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
								<ChangeDiff changes={request.changes} />
							</div>
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
				<li class="rounded-lg border border-[var(--dash-border)] p-4">
					<div class="flex flex-wrap items-baseline justify-between gap-2">
						<div>
							<h3 class="font-semibold">{entry.title}</h3>
							<p class="text-sm text-[var(--dash-text-secondary)]">
								{entry.target.label} · {when(entry.createdAt)} · by {SOURCE_LABELS[entry.source] ??
									entry.source}
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
						{:else if entry.whereInstead}
							<!--
								No undo for this one. Adding an entry has no reverse through the
								registry — it has no delete, deliberately — so the honest answer
								is where to do it by hand, the same shape as the assistant naming
								a page it cannot reach.

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
						<dl class="mt-3 space-y-2 text-sm">
							{#each entry.changes as change (change.field)}
								<div>
									<dt class="text-[var(--dash-text-secondary)]">{change.label}</dt>
									<dd class="break-words">
										<span class="line-through opacity-60">{summarizeValue(change.from)}</span>
										<span aria-hidden="true"> → </span>
										<span>{summarizeValue(change.to)}</span>
										<!--
											A replacement shorter than what it replaces is the one shape of
											edit whose loss is invisible — the new text reads perfectly well,
											and nothing about it says what used to be there.
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
							<ChangeDiff changes={entry.changes} />
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
