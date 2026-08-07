<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faArrowLeft, faCheck, faStickyNote } from '@fortawesome/free-solid-svg-icons';
	import Card from '../../../../components/Card.svelte';
	import ConversationTimeline from '$lib/components/conversation/ConversationTimeline.svelte';
	import type { VersionSource } from '$lib/server/ai-chat/entity-versions';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let sheet = $derived(data.sheet);
	let cheatSheetId = $derived(data.sheet.id);
	let conversation = $derived(data.conversation);

	// Title is edited + saved independently of content versioning, but an AI
	// generate on an unnamed sheet may set it server-side — re-sync when the server
	// value actually changes (mirrors the story editor's title handling), so an
	// invalidate doesn't clobber a title you're mid-way through typing.
	let title = $state(data.sheet.title ?? '');
	let syncedTitle = data.sheet.title ?? '';
	$effect(() => {
		const serverVal = data.sheet.title ?? '';
		if (serverVal !== syncedTitle) {
			syncedTitle = serverVal;
			title = serverVal;
		}
	});
	let titleDirty = $derived(title.trim().length > 0 && title.trim() !== (data.sheet.title ?? ''));

	const SHEET_LABELS: Record<VersionSource, string> = {
		manual_edit: 'Your edit',
		ai_generation: 'AI drafted sheet',
		ai_advice: 'AI recommendations',
		ai_review: 'AI review',
		ai_revision: 'AI revised sheet'
	};

	const placeholder = 'Write or paste your cheat sheet here…';

	async function apiGenerate(
		mode: 'generate' | 'advice' | 'review' | 'auto',
		instructions?: string
	) {
		const res = await fetch(`/api/ai/cheatsheets/${cheatSheetId}/generate`, {
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
		const res = await fetch(`/api/ai/cheatsheets/${cheatSheetId}/followup`, {
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
		const res = await fetch(`/applications/interview/cheatsheets/${cheatSheetId}?/${action}`, {
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
		if (sheet.ai_chat_id) {
			await apiFollowup(
				"Please review my cheat sheet and give me concise feedback: what's useful, what's missing, and any specific suggestions.",
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

	// Non-destructive: make a chosen version the live sheet without trimming.
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

	function handleTitleSave() {
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
</script>

<svelte:head>
	<title>Interview cheat sheet - Smart Job Seeker</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<a
		href="/applications/interview"
		class="inline-flex items-center gap-2 text-sm text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
	>
		<FontAwesomeIcon icon={faArrowLeft} class="h-3.5 w-3.5" /> Back to interview prep
	</a>

	<div class="flex items-center gap-3">
		<FontAwesomeIcon icon={faStickyNote} class="h-6 w-6 text-[var(--dash-primary)]" />
		<h2 class="text-xl font-bold text-[var(--dash-text)]">Interview cheat sheet</h2>
	</div>

	{#if form?.error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
		</div>
	{/if}

	<!-- Title (saved independently of the content versioning) -->
	<Card padding="md">
		<form method="POST" action="?/saveTitle" use:enhance={handleTitleSave}>
			<label
				for="sheet-title"
				class="mb-1 block text-sm font-medium text-[var(--dash-text-secondary)]"
			>
				Title <span class="text-[var(--dash-error)]">*</span>
			</label>
			<div class="flex items-start gap-2">
				<input
					id="sheet-title"
					name="title"
					bind:value={title}
					placeholder="e.g. System design topics"
					class="flex-1 rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				/>
				{#if titleDirty}
					<button
						type="submit"
						class="flex items-center gap-1.5 rounded-lg bg-[var(--dash-primary)] px-3 py-2 text-sm whitespace-nowrap text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
					>
						<FontAwesomeIcon icon={faCheck} class="h-3.5 w-3.5" /> Save title
					</button>
				{/if}
			</div>
		</form>
	</Card>

	<ConversationTimeline
		{conversation}
		aiChatId={sheet.ai_chat_id}
		{placeholder}
		labels={SHEET_LABELS}
		{onGenerate}
		{onReview}
		{onSendFollowup}
		{onSaveVersion}
		{onApplyVersion}
		{onClearResponse}
		autoMode={true}
		currentContent={sheet.content}
		applyNoun="sheet"
		generating={data.generating}
	/>
</div>
