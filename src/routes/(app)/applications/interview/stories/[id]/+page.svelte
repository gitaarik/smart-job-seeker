<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faArrowLeft, faBook, faCheck, faRobot } from '@fortawesome/free-solid-svg-icons';
	import Card from '../../../../components/Card.svelte';
	import ConversationTimeline from '$lib/components/conversation/ConversationTimeline.svelte';
	import AutoGrowTextarea from '$lib/components/AutoGrowTextarea.svelte';
	import type { VersionSource } from '$lib/server/ai-chat/entity-versions';
	import { serializeStarMarkdown } from '$lib/interview/star';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let story = $derived(data.story);
	let storyId = $derived(data.story.id);
	let conversation = $derived(data.conversation);

	// Title, category, and the five STAR fields are all editable manual surfaces,
	// seeded from `data` and kept in sync with the server row: an AI generate/revise
	// writes the columns and the inputs should reflect that. But an AI turn (or a
	// manual body save) only changes SOME columns, so we re-sync a field ONLY when
	// its server value actually changed since we last synced it — otherwise an
	// invalidate would clobber an unsaved edit to a field the server didn't touch
	// (e.g. a title you're mid-way through typing while saving the story body).
	let title = $state(data.story.title ?? '');
	let category = $state(data.story.category ?? '');
	let situation = $state(data.story.situation ?? '');
	let task = $state(data.story.task ?? '');
	let action = $state(data.story.action ?? '');
	let result = $state(data.story.result ?? '');
	let reflection = $state(data.story.reflection ?? '');

	// Plain (non-reactive) tracker of the last server value we synced per field.
	const synced: Record<string, string> = {
		title: data.story.title ?? '',
		category: data.story.category ?? '',
		situation: data.story.situation ?? '',
		task: data.story.task ?? '',
		action: data.story.action ?? '',
		result: data.story.result ?? '',
		reflection: data.story.reflection ?? ''
	};
	$effect(() => {
		const s = data.story;
		const setters: Record<string, (v: string) => void> = {
			title: (v) => (title = v),
			category: (v) => (category = v),
			situation: (v) => (situation = v),
			task: (v) => (task = v),
			action: (v) => (action = v),
			result: (v) => (result = v),
			reflection: (v) => (reflection = v)
		};
		const cols = s as unknown as Record<string, string | null>;
		for (const key of Object.keys(setters)) {
			const serverVal = cols[key] ?? '';
			if (serverVal !== synced[key]) {
				synced[key] = serverVal;
				setters[key](serverVal);
			}
		}
	});

	let metaDirty = $derived(
		title.trim().length > 0 &&
			(title.trim() !== (data.story.title ?? '') || category !== (data.story.category ?? ''))
	);
	let storyDirty = $derived(
		situation !== (data.story.situation ?? '') ||
			task !== (data.story.task ?? '') ||
			action !== (data.story.action ?? '') ||
			result !== (data.story.result ?? '') ||
			reflection !== (data.story.reflection ?? '')
	);

	// Serialized markdown of the in-progress STAR fields — posted to the save action
	// (the story is stored as columns; the version trail stores this markdown).
	let storyMarkdown = $derived(
		serializeStarMarkdown({ situation, task, action, result, reflection })
	);

	const categories = [
		{ value: 'leadership', label: 'Leadership' },
		{ value: 'problem_solving', label: 'Problem Solving' },
		{ value: 'teamwork', label: 'Teamwork' },
		{ value: 'technical', label: 'Technical Challenge' },
		{ value: 'conflict', label: 'Conflict Resolution' },
		{ value: 'innovation', label: 'Innovation' },
		{ value: 'failure', label: 'Learning from Failure' },
		{ value: 'achievement', label: 'Achievement' }
	];

	const STORY_LABELS: Record<VersionSource, string> = {
		manual_edit: 'Your edit',
		ai_generation: 'AI drafted story',
		ai_advice: 'AI recommendations',
		ai_review: 'AI review',
		ai_revision: 'AI revised story'
	};

	async function apiGenerate(
		mode: 'generate' | 'advice' | 'review' | 'auto',
		instructions?: string
	) {
		const res = await fetch(`/api/ai/stories/${storyId}/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ mode, ...(instructions ? { instructions } : {}) })
		});
		const result = await res.json();
		if (!result.success) throw new Error(result.message || 'Generation failed');
	}

	async function apiFollowup(
		text: string,
		updateContent: boolean,
		mode?: 'feedback' | 'review',
		replaceVersionId?: number
	) {
		const res = await fetch(`/api/ai/stories/${storyId}/followup`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				followupRequest: text,
				includeOriginalContext: true,
				updateContent,
				...(mode ? { mode } : {}),
				...(replaceVersionId ? { replaceVersionId } : {})
			})
		});
		const result = await res.json();
		if (!result.success) throw new Error(result.message || 'Follow-up failed');
	}

	// POST a form action and throw if it didn't succeed, so callers (wrapped in the
	// timeline's run()) surface the failure instead of silently doing nothing.
	async function postAction(action: string, fd: FormData) {
		const res = await fetch(`/applications/interview/stories/${storyId}?/${action}`, {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' },
			body: fd
		});
		const result = await res.json().catch(() => null);
		if (result?.type !== 'success') {
			throw new Error("That change couldn't be saved — please try again.");
		}
	}

	async function apiSaveContent(content: string, deleteAfterVersionId?: number) {
		const fd = new FormData();
		fd.set('content', content);
		fd.set('source', 'manual_edit');
		if (deleteAfterVersionId) {
			fd.set('deleteAfterVersionId', String(deleteAfterVersionId));
		}
		await postAction('save', fd);
	}

	// ---- Timeline callbacks (persist + invalidate; throw a message on failure) ----

	async function onGenerate(mode: 'generate' | 'advice' | 'auto', instructions?: string) {
		await apiGenerate(mode, instructions);
		await invalidateAll();
	}

	async function onReview(content: string) {
		const latestContent = conversation.findLast((e) => e.content)?.content;
		if (content !== latestContent) {
			await apiSaveContent(content);
			await invalidateAll();
		}
		if (story.ai_chat_id) {
			await apiFollowup(
				'Please review my story and give me concise feedback: what works well, what could be stronger, and any specific suggestions.',
				false,
				'review'
			);
		} else {
			await apiGenerate('review');
		}
		await invalidateAll();
	}

	async function onSendFollowup(
		text: string,
		opts: { updateContent: boolean; replaceVersionId?: number }
	) {
		await apiFollowup(text, opts.updateContent, undefined, opts.replaceVersionId);
		await invalidateAll();
	}

	async function onSaveVersion(content: string, opts: { deleteAfterVersionId?: number }) {
		await apiSaveContent(content, opts.deleteAfterVersionId);
		await invalidateAll();
	}

	// Non-destructive: make a chosen version the live story without trimming.
	async function onApplyVersion(content: string) {
		const fd = new FormData();
		fd.set('content', content);
		await postAction('applyVersion', fd);
		await invalidateAll();
	}

	// Delete a turn's AI response but keep the message (rewind to it).
	async function onClearResponse(versionId: number) {
		const fd = new FormData();
		fd.set('versionId', String(versionId));
		await postAction('clearResponse', fd);
		await invalidateAll();
	}

	// Manual save of the STAR fields (records a version + commits the columns).
	let savingStory = $state(false);
	let storyError = $state<string | null>(null);
	async function saveStory() {
		if (savingStory) return;
		savingStory = true;
		storyError = null;
		try {
			await apiSaveContent(storyMarkdown);
			await invalidateAll();
		} catch (e) {
			storyError = e instanceof Error ? e.message : "Couldn't save your story.";
		} finally {
			savingStory = false;
		}
	}

	function handleMetaSave() {
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			await update();
			if (result.type === 'success') await invalidateAll();
		};
	}

	// Height is managed by AutoGrowTextarea (resize:none) — no resize-y / min-h here.
	const fieldClass =
		'w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent';
</script>

<svelte:head>
	<title>Project story - Smart Job Seeker</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<a
		href="/applications/interview"
		class="inline-flex items-center gap-2 text-sm text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
	>
		<FontAwesomeIcon icon={faArrowLeft} class="h-3.5 w-3.5" /> Back to interview prep
	</a>

	<div class="flex items-center gap-3">
		<FontAwesomeIcon icon={faBook} class="h-6 w-6 text-[var(--dash-primary)]" />
		<h2 class="text-xl font-bold text-[var(--dash-text)]">Project story</h2>
	</div>

	{#if form?.error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
		</div>
	{/if}

	<!--
		What the story is about, when it says so.

		Read-only here, and linked: the link is set from the project's page, which
		is where the applicant is when they know the answer. Showing it on this end
		too is what makes it a relationship rather than a hidden column — and it
		tells them why the AI has this project's details when they never mentioned
		it in the conversation.
	-->
	{#if data.linkedProject}
		{@const linked = data.linkedProject}
		<p class="text-sm text-[var(--dash-text-secondary)]">
			About
			{#if linked.kind === 'work_experience_project' && linked.workExperienceId !== null}
				<a
					href={resolve('/(app)/profile/(data)/work-experience/[id]/projects/[pid]/stories', {
						id: String(linked.workExperienceId),
						pid: String(linked.id)
					})}
					class="dash-link"
				>
					{linked.name}{linked.context ? ` (${linked.context})` : ''}
				</a>
			{:else if linked.kind === 'side_project'}
				<a
					href={resolve('/(app)/profile/(data)/side-projects/[id]/stories', {
						id: String(linked.id)
					})}
					class="dash-link"
				>
					{linked.name}
				</a>
			{:else}
				<span class="text-[var(--dash-text)]">{linked.name}</span>
			{/if}
			— the AI writes this story from that project's details and attached notes.
		</p>
	{/if}

	<!-- Title + category (saved independently of the STAR versioning) -->
	<Card padding="md">
		<form method="POST" action="?/saveMeta" use:enhance={handleMetaSave}>
			<div class="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
				<div>
					<label
						for="story-title"
						class="mb-1 block text-sm font-medium text-[var(--dash-text-secondary)]"
					>
						Title <span class="text-[var(--dash-error)]">*</span>
					</label>
					<input
						id="story-title"
						name="title"
						bind:value={title}
						placeholder="e.g. Led the migration off a jammed job queue"
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>
				<div>
					<label
						for="story-category"
						class="mb-1 block text-sm font-medium text-[var(--dash-text-secondary)]">Category</label
					>
					<select
						id="story-category"
						name="category"
						bind:value={category}
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					>
						<option value="">Select a category</option>
						{#each categories as cat}
							<option value={cat.value}>{cat.label}</option>
						{/each}
					</select>
				</div>
				{#if metaDirty}
					<button
						type="submit"
						class="flex items-center gap-1.5 rounded-lg bg-[var(--dash-primary)] px-3 py-2 text-sm whitespace-nowrap text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
					>
						<FontAwesomeIcon icon={faCheck} class="h-3.5 w-3.5" /> Save
					</button>
				{/if}
			</div>
		</form>
	</Card>

	<!-- The story itself: the STAR fields are the manual surface. Write them
       yourself, or let the AI below draft/refine them — they stay in sync. -->
	<Card padding="md">
		<div class="mb-3 flex items-center justify-between gap-3">
			<h3 class="text-sm font-semibold text-[var(--dash-text)]">Your story</h3>
			{#if storyDirty}
				<button
					type="button"
					onclick={saveStory}
					disabled={savingStory}
					class="flex items-center gap-1.5 rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-xs whitespace-nowrap text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
				>
					<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
					{savingStory ? 'Saving…' : 'Save story'}
				</button>
			{/if}
		</div>
		{#if storyError}
			<p class="mb-2 text-xs text-[var(--dash-error)]">{storyError}</p>
		{/if}
		<p class="mb-3 text-xs text-[var(--dash-text-muted)]">
			Structure it with STAR — Situation, Task, Action, Result. Fill in what you can; the AI
			assistant below can draft or sharpen any part from your profile.
		</p>
		<div class="space-y-4">
			<div>
				<label for="f-situation" class="mb-1 block text-sm font-semibold text-[var(--dash-text)]"
					>Situation</label
				>
				<AutoGrowTextarea
					id="f-situation"
					bind:value={situation}
					minRows={3}
					placeholder="The context and background…"
					class={fieldClass}
				/>
			</div>
			<div>
				<label for="f-task" class="mb-1 block text-sm font-semibold text-[var(--dash-text)]"
					>Task</label
				>
				<AutoGrowTextarea
					id="f-task"
					bind:value={task}
					minRows={2}
					placeholder="Your responsibility or goal…"
					class={fieldClass}
				/>
			</div>
			<div>
				<label for="f-action" class="mb-1 block text-sm font-semibold text-[var(--dash-text)]"
					>Action</label
				>
				<AutoGrowTextarea
					id="f-action"
					bind:value={action}
					minRows={4}
					placeholder="What you specifically did…"
					class={fieldClass}
				/>
			</div>
			<div>
				<label for="f-result" class="mb-1 block text-sm font-semibold text-[var(--dash-text)]"
					>Result</label
				>
				<AutoGrowTextarea
					id="f-result"
					bind:value={result}
					minRows={3}
					placeholder="The outcome — with metrics if you have them…"
					class={fieldClass}
				/>
			</div>
			<div>
				<label for="f-reflection" class="mb-1 block text-sm font-semibold text-[var(--dash-text)]"
					>Reflection <span class="font-normal text-[var(--dash-text-muted)]">(optional)</span
					></label
				>
				<AutoGrowTextarea
					id="f-reflection"
					bind:value={reflection}
					minRows={2}
					placeholder="What you learned…"
					class={fieldClass}
				/>
			</div>
		</div>
	</Card>

	<!-- AI assistant: same conversational surface as the application texts editor.
       It owns no separate "write your own version" box — the STAR fields above
       are the manual surface (ownVersionEditor={false}). -->
	<div class="space-y-3">
		<div class="flex items-center gap-2">
			<FontAwesomeIcon icon={faRobot} class="h-4 w-4 text-[var(--dash-primary)]" />
			<h3 class="text-sm font-semibold text-[var(--dash-text)]">Work on it with AI</h3>
		</div>
		<ConversationTimeline
			{conversation}
			aiChatId={story.ai_chat_id}
			placeholder="Write your story in the fields above…"
			labels={STORY_LABELS}
			ownVersionEditor={false}
			autoMode={true}
			generating={data.generating}
			{onGenerate}
			{onReview}
			{onSendFollowup}
			{onSaveVersion}
			{onApplyVersion}
			{onClearResponse}
			currentContent={data.currentStar}
			applyNoun="story"
		/>
	</div>
</div>
