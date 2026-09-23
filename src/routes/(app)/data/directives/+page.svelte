<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faClipboardList, faPen, faStop } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** The topic whose editor is open, if any. One at a time keeps the page calm. */
	let editing = $state<string | null>(null);

	function day(date: Date | string): string {
		return new Date(date).toLocaleDateString(undefined, { dateStyle: 'medium' });
	}

	function joinList(parts: string[]): string {
		if (parts.length <= 1) return parts[0] ?? '';
		return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
	}
</script>

<svelte:head>
	<title>Directives - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader title="Directives" icon={faClipboardList} />

	<p class="text-[var(--dash-text-secondary)]">
		What you have told the assistant to keep to from now on, across every job and application. When
		you state one in a chat it proposes it as a card, and nothing is kept until you apply that card.
		Each topic holds one directive: a new one replaces the old, which stays in the history below.
	</p>

	{#if form?.error}
		<p
			class="rounded-lg border p-3 text-sm"
			style="background-color: var(--dash-error-light); border-color: var(--dash-error); color: var(--dash-error);"
		>
			{form.error}
		</p>
	{/if}

	<ul class="space-y-4">
		{#each data.topics as topic (topic.topic)}
			<li class="rounded-lg border p-4" style="border-color: var(--dash-border);">
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<div>
						<h2 class="font-semibold">{topic.label}</h2>
						<p class="text-sm text-[var(--dash-text-secondary)]">{topic.what}</p>
					</div>

					{#if topic.live && editing !== topic.topic}
						<div class="flex gap-2">
							<button
								type="button"
								class="flex items-center gap-2 rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm hover:bg-[var(--dash-surface-hover)]"
								onclick={() => (editing = topic.topic)}
							>
								<FontAwesomeIcon icon={faPen} class="h-3.5 w-3.5" />
								Change
							</button>
							<form method="POST" action="?/stop" use:enhance>
								<input type="hidden" name="topic" value={topic.topic} />
								<button
									type="submit"
									class="flex items-center gap-2 rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm hover:bg-[var(--dash-surface-hover)]"
								>
									<FontAwesomeIcon icon={faStop} class="h-3.5 w-3.5" />
									Stop using
								</button>
							</form>
						</div>
					{/if}
				</div>

				{#if editing === topic.topic || (!topic.live && editing === `new:${topic.topic}`)}
					<form
						method="POST"
						action="?/save"
						class="mt-3 space-y-2"
						use:enhance={() =>
							async ({ result, update }) => {
								await update();
								if (result.type === 'success') editing = null;
							}}
					>
						<input type="hidden" name="topic" value={topic.topic} />
						<textarea
							name="statement"
							rows="3"
							maxlength={data.maxChars}
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
							>{topic.live?.statement ?? ''}</textarea
						>
						<div class="flex gap-2">
							<button
								type="submit"
								class="rounded-md px-3 py-1.5 text-sm text-white"
								style="background-color: var(--dash-primary);"
							>
								Save
							</button>
							<button
								type="button"
								class="rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm hover:bg-[var(--dash-surface-hover)]"
								onclick={() => (editing = null)}
							>
								Cancel
							</button>
						</div>
					</form>
				{:else if topic.live}
					<p class="mt-3 whitespace-pre-line">{topic.live.statement}</p>
					<p class="mt-2 text-xs text-[var(--dash-text-secondary)]">
						Stated {day(topic.live.statedAt)} · recorded by {topic.live.source} · used by {joinList(
							topic.usedBy
						)}
					</p>
				{:else}
					<p class="mt-3 text-sm text-[var(--dash-text-secondary)]">
						Nothing recorded.
						<button
							type="button"
							class="underline"
							onclick={() => (editing = `new:${topic.topic}`)}
						>
							Add one
						</button>
					</p>
				{/if}
			</li>
		{/each}
	</ul>

	{#if data.history.length > 0}
		<section class="space-y-3">
			<h2 class="text-lg font-semibold">History</h2>
			<p class="text-sm text-[var(--dash-text-secondary)]">
				Directives that were replaced or stopped, newest first. Kept so every change can be read
				back; an undo is on Recent Changes.
			</p>
			<ul class="space-y-2">
				{#each data.history as entry (entry.id)}
					<li class="text-sm">
						<span class="font-medium">{entry.label}:</span>
						<span class="opacity-80">{entry.statement}</span>
						<span class="text-xs text-[var(--dash-text-secondary)]">
							— stated {day(entry.statedAt)}{#if entry.endedAt}, {entry.replaced
									? 'replaced'
									: 'stopped'}
								{day(entry.endedAt)}{/if}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
