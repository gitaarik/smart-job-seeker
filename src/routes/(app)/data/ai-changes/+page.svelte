<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faHistory, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** Which surface asked for the change, in words rather than a column value. */
	const SOURCE_LABELS: Record<string, string> = {
		chat: 'the assistant',
		mcp: 'a connected app'
	};

	function when(date: Date | string): string {
		return new Date(date).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}
</script>

<svelte:head>
	<title>AI Changes - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader title="AI Changes" icon={faHistory} />

	<p class="text-[var(--dash-text-secondary)]">
		Every change made to your data through the assistant, newest first, with what it replaced. Undo
		puts the old value back exactly as it was — which also means it overwrites anything you have
		changed since.
	</p>

	{#if form?.error}
		<p
			class="rounded-lg border p-3 text-sm"
			style="background-color: var(--dash-error-light); border-color: var(--dash-error); color: var(--dash-error);"
		>
			{form.error}
		</p>
	{/if}

	{#if data.entries.length === 0}
		<p class="rounded-lg border border-[var(--dash-border)] p-6 text-[var(--dash-text-secondary)]">
			Nothing yet. When you accept a change the assistant proposes, it is recorded here.
		</p>
	{:else}
		<ul class="space-y-4">
			{#each data.entries as entry (entry.id)}
				<li class="rounded-lg border border-[var(--dash-border)] p-4">
					<div class="flex flex-wrap items-baseline justify-between gap-2">
						<div>
							<h3 class="font-semibold">{entry.title}</h3>
							<p class="text-sm text-[var(--dash-text-secondary)]">
								{entry.target.label} · {when(entry.createdAt)} · via {SOURCE_LABELS[entry.source] ??
									entry.source}
							</p>
						</div>

						{#if entry.revertedAt}
							<span class="text-sm text-[var(--dash-text-secondary)]">
								Undone {when(entry.revertedAt)}
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
										<span class="line-through opacity-60">{change.from || '—'}</span>
										<span aria-hidden="true"> → </span>
										<span>{change.to || '—'}</span>
									</dd>
								</div>
							{/each}
						</dl>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
