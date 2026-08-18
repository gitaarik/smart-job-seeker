<script lang="ts">
	/**
	 * The interview stories written about one project.
	 *
	 * The stories themselves are edited where they always have been — the STAR
	 * editor under interview prep, with its conversation timeline and version
	 * trail. Nothing about that is duplicated here. What this adds is the link
	 * that was missing: `project_stories` is *called* project stories and had no
	 * way to name a project, so a story floated free of the work it described and
	 * the generator had to guess the subject from the title.
	 *
	 * Naming it is worth more than the list: a linked story pins its project into
	 * the generation context, so the model writes about the project the applicant
	 * chose rather than whichever one the ranker surfaced.
	 */
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faChevronRight, faLink, faPlus } from '@fortawesome/free-solid-svg-icons';

	export interface StoryRow {
		id: number;
		title: string | null;
		category: string | null;
		/** Where it is linked now, when that is somewhere other than this project. */
		linkedElsewhere?: string | null;
	}

	let {
		profileId,
		kind,
		projectId,
		projectName,
		stories,
		candidates
	}: {
		profileId: number;
		kind: 'work_experience_project' | 'side_project';
		projectId: number;
		projectName: string;
		/** Stories linked to this project. */
		stories: StoryRow[];
		/** The profile's other stories, offered for linking. */
		candidates: StoryRow[];
	} = $props();

	let error = $state<string | null>(null);

	// --- Writing a new one ---
	let adding = $state(false);
	let newTitle = $state('');
	let creating = $state(false);

	async function createStory(e: SubmitEvent) {
		e.preventDefault();
		const title = newTitle.trim();
		if (!title || creating) return;
		creating = true;
		error = null;
		try {
			const res = await fetch('/api/interview-stories', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					profile_id: profileId,
					title,
					[kind === 'side_project' ? 'side_project_id' : 'work_experience_project_id']: projectId
				})
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				error = body?.error ?? 'Could not create that story.';
				return;
			}
			await goto(
				resolve('/(app)/applications/interview/stories/[id]', { id: String(body.story.id) })
			);
		} catch {
			error = 'Could not create that story.';
		} finally {
			creating = false;
		}
	}

	// --- Linking / unlinking an existing one ---
	let linking = $state(false);
	let chosen = $state('');
	let busyId = $state<number | null>(null);

	async function setLink(storyId: number, link: boolean) {
		if (busyId !== null) return;
		busyId = storyId;
		error = null;
		try {
			const res = await fetch(`/api/interview-stories/${storyId}/project`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					profile_id: profileId,
					kind: link ? kind : null,
					project_id: link ? projectId : null
				})
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				error = body?.error ?? 'Could not change that link.';
				return;
			}
			chosen = '';
			linking = false;
			await invalidateAll();
		} catch {
			error = 'Could not change that link.';
		} finally {
			busyId = null;
		}
	}
</script>

<div>
	<h2 class="mb-1 text-lg font-semibold text-[var(--dash-text)]">Interview stories</h2>
	<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
		STAR stories about this project, for behavioural interviews. A story linked here knows what it
		is about, so the AI writes from this project's details, technologies and attached notes instead
		of guessing which project you meant.
	</p>

	{#if stories.length === 0}
		<p class="text-sm text-[var(--dash-text-secondary)]">No stories about this project yet.</p>
	{:else}
		<div class="space-y-2">
			{#each stories as story (story.id)}
				<div
					class="flex items-center rounded-lg border border-[var(--dash-border)] transition-colors hover:border-[var(--dash-primary)]/40"
				>
					<a
						href={resolve('/(app)/applications/interview/stories/[id]', { id: String(story.id) })}
						class="flex min-w-0 flex-1 items-center gap-3 px-4 py-3"
					>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-[var(--dash-text)]">
								{story.title || 'Untitled story'}
							</span>
							{#if story.category}
								<span class="mt-0.5 block text-xs text-[var(--dash-text-muted)]">
									{story.category}
								</span>
							{/if}
						</span>
						<FontAwesomeIcon
							icon={faChevronRight}
							class="h-3 w-3 shrink-0 text-[var(--dash-text-secondary)]"
						/>
					</a>
					<button
						type="button"
						onclick={() => setLink(story.id, false)}
						disabled={busyId === story.id}
						class="px-3 py-3 text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)] disabled:opacity-50"
						title="Keep the story, but stop saying it is about this project"
					>
						Unlink
					</button>
				</div>
			{/each}
		</div>
	{/if}

	{#if error}
		<p class="mt-2 text-sm text-[var(--dash-error)]">{error}</p>
	{/if}

	{#if adding}
		<form onsubmit={createStory} class="mt-3 flex flex-wrap items-center gap-2">
			<!-- svelte-ignore a11y_autofocus -->
			<input
				bind:value={newTitle}
				autofocus
				placeholder="What is the story about? (e.g. “The release that broke on a Friday”)"
				class="min-w-0 flex-1 rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
			/>
			<button
				type="submit"
				disabled={creating || !newTitle.trim()}
				class="rounded-md bg-[var(--dash-primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
			>
				{creating ? 'Creating…' : 'Create and write'}
			</button>
			<button
				type="button"
				onclick={() => (adding = false)}
				class="rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
			>
				Cancel
			</button>
		</form>
	{:else if linking}
		<div class="mt-3 flex flex-wrap items-center gap-2">
			<select
				bind:value={chosen}
				class="min-w-0 flex-1 rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
			>
				<option value="">Choose a story…</option>
				{#each candidates as story (story.id)}
					<option value={String(story.id)}>
						{story.title || 'Untitled story'}{story.linkedElsewhere
							? ` — currently on ${story.linkedElsewhere}`
							: ''}
					</option>
				{/each}
			</select>
			<button
				type="button"
				onclick={() => chosen && setLink(Number(chosen), true)}
				disabled={!chosen || busyId !== null}
				class="rounded-md bg-[var(--dash-primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
			>
				Link to {projectName || 'this project'}
			</button>
			<button
				type="button"
				onclick={() => {
					linking = false;
					chosen = '';
				}}
				class="rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
			>
				Cancel
			</button>
		</div>
	{:else}
		<div class="mt-3 flex flex-wrap items-center gap-4">
			<button
				type="button"
				onclick={() => {
					adding = true;
					newTitle = '';
					error = null;
				}}
				class="flex items-center gap-1 text-sm text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
			>
				<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
				Write a story about this project
			</button>
			{#if candidates.length > 0}
				<button
					type="button"
					onclick={() => (linking = true)}
					class="flex items-center gap-1 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
				>
					<FontAwesomeIcon icon={faLink} class="h-3 w-3" />
					Link one you have already written
				</button>
			{/if}
		</div>
	{/if}
</div>
