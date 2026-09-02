<script lang="ts">
	/**
	 * Shared conversation-timeline editor for application texts (cover letters and
	 * question answers). Renders the version thread as inline bubbles with
	 * word-level diffs, inline editing, AI review, and a followup feedback loop.
	 *
	 * It owns all ephemeral UI state (which version is being edited, diff
	 * show/hide, busy/error, scroll-to-last) and the busy/scroll/error
	 * orchestration. It owns NO persistence: every mutation is delegated to a
	 * callback the host page supplies, which performs the fetch/action and
	 * `invalidateAll()`s before resolving. Callbacks throw on failure with a
	 * user-facing message, which this component surfaces.
	 */
	import { afterNavigate } from '$app/navigation';
	import { tick } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCheck,
		faChevronDown,
		faChevronUp,
		faComments,
		faEye,
		faEyeSlash,
		faPencil,
		faRobot,
		faRotateRight,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import { renderSafeMarkdown } from '$lib/utils/safe-markdown';
	import { computeDiff, isSmallDiff } from '$lib/utils/word-diff';
	import Card from '../../../routes/(app)/components/Card.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import GenerationStatus from '$lib/components/GenerationStatus.svelte';
	import SimpleEditor from '$lib/components/SimpleEditor.svelte';
	import ConfirmModal from '../../../routes/(app)/profile/components/ConfirmModal.svelte';
	import type { ConversationEntry, VersionSource } from '$lib/server/ai-chat/entity-versions';

	type BusyMode = 'generate' | 'advice' | 'auto' | 'followup' | 'review';

	let {
		conversation,
		aiChatId,
		placeholder,
		labels,
		onGenerate,
		onReview,
		onSendFollowup,
		onSaveVersion,
		onApplyVersion,
		onClearResponse,
		currentContent = null,
		applyNoun = 'answer',
		ownVersionEditor = true,
		autoMode = false,
		generating = false
	}: {
		conversation: ConversationEntry[];
		/**
		 * Null means no AI thread exists yet: the composer offers the two
		 * thread-starting steps (advice / generate) instead of a followup message.
		 */
		aiChatId: number | null;
		/** Placeholder for the "write my own version" editor. */
		placeholder: string;
		/** Human labels per version source (entity-specific wording). */
		labels: Record<VersionSource, string>;
		/**
		 * Start an AI thread. `instructions` is the applicant's optional brief for
		 * that first turn, typed in the composer — blank runs the plain prompt.
		 */
		onGenerate: (mode: 'generate' | 'advice' | 'auto', instructions?: string) => Promise<void>;
		onReview: (content: string) => Promise<void>;
		onSendFollowup: (
			text: string,
			opts: { updateContent: boolean; replaceVersionId?: number }
		) => Promise<void>;
		onSaveVersion: (content: string, opts: { deleteAfterVersionId?: number }) => Promise<void>;
		/**
		 * Optional: commit a specific version's content as the entity's live value
		 * (the question's answer) without trimming later versions. When omitted, the
		 * "use as answer" affordance is hidden (e.g. letters don't opt in).
		 */
		onApplyVersion?: (content: string) => Promise<void>;
		/**
		 * Optional: delete a turn's AI response but keep the user's message (rewind
		 * to it), so it can be edited/regenerated. Enables the per-turn trash +
		 * "regenerate" affordances.
		 */
		onClearResponse?: (versionId: number) => Promise<void>;
		/** The entity's current committed content, used to mark the live version. */
		currentContent?: string | null;
		/** Noun for the apply affordance, e.g. "answer". */
		applyNoun?: string;
		/**
		 * Whether the timeline owns the "write / paste my own version" surface. When
		 * false, the host supplies its own manual editor (e.g. the STAR fields on
		 * the story editor) and this component hides its markdown composer + the
		 * per-version inline Edit, so there's one manual surface, not two. AI actions
		 * (advice/generate/send/review) and version history stay. Defaults true —
		 * letters and questions are unaffected.
		 */
		ownVersionEditor?: boolean;
		/**
		 * When true, the pre-thread composer collapses the separate "AI advice" and
		 * "AI generate" buttons into one "Send to AI" that runs the model-decides
		 * `auto` turn (draft vs. advice, per message), plus quick "Write a draft" /
		 * "Get advice" starter chips. When false, the two explicit buttons show (the
		 * pre-pilot behaviour).
		 *
		 * Defaults false, but every caller now passes true — cover letters,
		 * application questions, interview stories and cheat sheets — so the
		 * `false` branch is unreached in the app and only survives as the fallback
		 * for a caller that omits the prop.
		 */
		autoMode?: boolean;
		/**
		 * Whether a generation is currently in flight for this entity, tracked
		 * server-side so it survives a refresh. Shows a resumable "AI is working…"
		 * banner that polls for the result. Independent of the ephemeral `busy`
		 * spinner (which only covers a generation started in THIS tab).
		 */
		generating?: boolean;
	} = $props();

	// Whether an AI thread exists to follow up on. Drives the composer's button
	// row: no thread → the two starting steps; thread → send a message.
	let hasThread = $derived(aiChatId !== null);

	// Compute version numbers: only entries with content get a version number
	let entryVersionNums = $derived.by(() => {
		const nums: number[] = [];
		let ver = 1;
		for (const entry of conversation) {
			if (entry.content) {
				nums.push(ver);
				ver++;
			} else {
				nums.push(0); // no version for advice-only entries
			}
		}
		return nums;
	});

	// Index of the latest content-bearing version — the "delete response" trash
	// lives on it so rewinding steps back one turn at a time.
	let lastContentIndex = $derived.by(() => {
		let idx = -1;
		conversation.forEach((e, i) => {
			if (e.content) idx = i;
		});
		return idx;
	});

	// Collapse: when there are earlier turns before the latest version (advice
	// replies and older versions both count), hide them by default and show only
	// the latest version + anything after it. `lastContentIndex` is how many
	// entries precede the latest version, i.e. how many collapsing hides.
	let hiddenTurns = $derived(lastContentIndex > 0 ? lastContentIndex : 0);
	let canCollapse = $derived(hiddenTurns > 0);
	let userExpanded = $state(false);
	let collapsed = $derived(canCollapse && !userExpanded);

	// Inline edit state: which version index is being edited (null = none).
	let editingIndex = $state<number | null>(null);
	let editContent = $state('');
	let isEditing = $derived(editingIndex !== null);

	// AI orchestration state (owned here; callbacks are awaited through run()).
	let busy = $state(false);
	let busyMode = $state<BusyMode | null>(null);
	let aiError = $state<string | null>(null);
	let feedbackText = $state('');

	// Bottom composer: "write / paste my own version" editor (kept distinct from
	// the chat input so a message to the AI is never mistaken for an answer).
	let composerOpen = $state(false);
	let composerContent = $state('');

	// Feedback editing state
	let editingFeedbackIndex = $state<number | null>(null);
	let editingFeedbackText = $state('');

	// Scroll target
	let lastEntryEl = $state<HTMLElement | null>(null);

	// Confirm dialog for saving a previous version (will remove later entries)
	let showOverwriteConfirm = $state(false);
	let pendingOverwrite = $state<{ content: string; versionId: number } | null>(null);

	// Diff view state: manually toggled on/off overrides auto-show
	let diffShown = $state(new Set<number>());
	let diffHidden = $state(new Set<number>());

	// Scroll to last entry on page load / navigation
	afterNavigate(async () => {
		await tick();
		lastEntryEl?.scrollIntoView({ block: 'start' });
	});

	/**
	 * Run one host callback with the shared busy/scroll/error choreography.
	 * The callback persists + invalidates; on failure it throws a message.
	 */
	async function run(mode: BusyMode, fn: () => Promise<void>) {
		busy = true;
		busyMode = mode;
		aiError = null;
		try {
			await fn();
			await tick();
			lastEntryEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		} catch (e) {
			aiError = e instanceof Error && e.message ? e.message : 'Network error. Please try again.';
		} finally {
			busy = false;
			busyMode = null;
		}
	}

	function getPreviousContent(entryIndex: number): string | null {
		for (let i = entryIndex - 1; i >= 0; i--) {
			if (conversation[i].content) return conversation[i].content!;
		}
		return null;
	}

	function shouldAutoShowDiff(entryIndex: number): boolean {
		const prev = getPreviousContent(entryIndex);
		if (!prev) return false;
		const entry = conversation[entryIndex];
		if (!entry.content) return false;
		const segments = computeDiff(prev, entry.content);
		return isSmallDiff(segments);
	}

	function toggleDiff(entryIndex: number, currentlyShowing: boolean) {
		if (currentlyShowing) {
			diffShown.delete(entryIndex);
			diffHidden.add(entryIndex);
		} else {
			diffHidden.delete(entryIndex);
			diffShown.add(entryIndex);
		}
		diffShown = new Set(diffShown);
		diffHidden = new Set(diffHidden);
	}

	async function startEdit(content: string, index: number) {
		editContent = content;
		editingIndex = index;
		await tick();
		const textarea = document.querySelector<HTMLTextAreaElement>('textarea[name="content"]');
		if (textarea) {
			const rect = textarea.getBoundingClientRect();
			if (rect.top < 0 || rect.bottom > window.innerHeight) {
				textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}
	}

	function cancelEdit() {
		editingIndex = null;
	}

	function isEditingPreviousVersion(): boolean {
		if (editingIndex === null) return false;
		for (let i = editingIndex + 1; i < conversation.length; i++) {
			if (conversation[i].content || conversation[i].aiFeedback || conversation[i].userRequest)
				return true;
		}
		return false;
	}

	/**
	 * The number the edit in progress will be saved as. An inline edit never
	 * overwrites the version it started from: it is appended as the next one, and
	 * editing an earlier version trims what came after it, so either way the new
	 * version follows the one on screen.
	 */
	let nextVersionNum = $derived(
		editingIndex === null ? 0 : (entryVersionNums[editingIndex] ?? 0) + 1
	);

	// A save that changes nothing records no version (recordVersionIfChanged skips
	// it), so the labels must not promise one.
	let editChanged = $derived(
		editingIndex !== null &&
			editContent.trim() !== (conversation[editingIndex]?.content ?? '').trim()
	);

	/**
	 * Open the newest version's diff after a save, whatever its size. The
	 * auto-show only fires below isSmallDiff's threshold, which hides exactly the
	 * rewrites most worth seeing, and the version the edit was based on is behind
	 * the collapse bar by then. Without this there is nothing on screen saying the
	 * edit landed as a new version rather than overwriting the old one.
	 */
	async function revealLatestDiff() {
		await tick();
		const idx = conversation.findLastIndex((e) => e.content);
		if (idx < 0) return;
		diffHidden.delete(idx);
		diffShown.add(idx);
		diffShown = new Set(diffShown);
		diffHidden = new Set(diffHidden);
	}

	function saveEdit() {
		if (isEditingPreviousVersion()) {
			const entry = conversation[editingIndex!];
			pendingOverwrite = { content: editContent, versionId: entry.versionId };
			showOverwriteConfirm = true;
		} else {
			const content = editContent;
			run('followup', async () => {
				await onSaveVersion(content, {});
				editingIndex = null;
				await revealLatestDiff();
			});
		}
	}

	/**
	 * Commit the edit and ask for a review in one step, mirroring the composer's
	 * "Save & AI review". onReview persists the content before reviewing, but it
	 * appends instead of trimming, so this is only offered when the edit is not
	 * rewinding to an earlier version.
	 */
	function saveEditAndReview() {
		const content = editContent;
		run('review', async () => {
			await onReview(content);
			editingIndex = null;
			await revealLatestDiff();
		});
	}

	function confirmOverwrite() {
		showOverwriteConfirm = false;
		const pending = pendingOverwrite;
		pendingOverwrite = null;
		if (!pending) return;
		run('followup', async () => {
			await onSaveVersion(pending.content, { deleteAfterVersionId: pending.versionId });
			editingIndex = null;
			await revealLatestDiff();
		});
	}

	function formatDate(date: Date | string | null): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function entryLabel(entry: ConversationEntry): string {
		return labels[entry.type] ?? 'Version';
	}

	function isUserEntry(entry: ConversationEntry): boolean {
		return entry.type === 'manual_edit';
	}
</script>

{#if generating}
	<div class="mb-3">
		<GenerationStatus active={generating} />
	</div>
{/if}

{#if aiError}
	<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
		<p class="text-sm text-[var(--dash-error)]">{aiError}</p>
	</div>
{/if}

{#snippet conversationEntry(
	entry: ConversationEntry,
	versionNum: number,
	isLast: boolean,
	entryIndex: number
)}
	{@const userEntry = isUserEntry(entry)}
	{@const borderColor = userEntry ? 'border-blue-500/20' : 'border-purple-500/20'}
	{@const bgColor = userEntry ? 'bg-blue-500/10' : 'bg-purple-500/10'}
	{@const versionBgColor = userEntry ? 'bg-blue-500/15' : 'bg-purple-500/15'}
	{@const iconBg = userEntry ? 'bg-blue-500/15' : 'bg-purple-500/15'}
	{@const iconColor = userEntry ? 'text-blue-600' : 'text-purple-600'}
	<div class="space-y-3">
		{#if entry.userRequest}
			<div class="ml-6 rounded-lg border border-blue-500/20 bg-blue-500/10 p-2">
				<div class="mb-0.5 flex items-center justify-between">
					<div class="flex items-center gap-1.5">
						<div
							class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/15"
						>
							<FontAwesomeIcon icon={faPencil} class="h-2 w-2 text-blue-600" />
						</div>
						<p class="text-xs text-[var(--dash-text-muted)]">Your feedback</p>
					</div>
					{#if editingFeedbackIndex !== entryIndex && !busy}
						<div class="flex items-center gap-2">
							{#if onClearResponse && !entry.content && !entry.aiFeedback}
								<button
									type="button"
									onclick={() =>
										run('followup', () =>
											onSendFollowup(entry.userRequest!, {
												updateContent: true,
												replaceVersionId: entry.versionId
											})
										)}
									class="flex items-center gap-1 text-xs text-[var(--dash-primary)] transition-colors hover:text-[var(--dash-primary-hover)]"
								>
									<FontAwesomeIcon icon={faRotateRight} class="h-2 w-2" />
									Regenerate
								</button>
							{/if}
							<button
								type="button"
								onclick={() => {
									editingFeedbackIndex = entryIndex;
									editingFeedbackText = entry.userRequest!;
								}}
								class="flex items-center gap-1 text-xs text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-primary)]"
							>
								<FontAwesomeIcon icon={faPencil} class="h-2 w-2" />
								Edit
							</button>
						</div>
					{/if}
				</div>
				{#if editingFeedbackIndex === entryIndex}
					<textarea
						bind:value={editingFeedbackText}
						rows={3}
						disabled={busy}
						class="mt-1 w-full resize-y rounded-md border border-[var(--dash-border)] px-2 py-1.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none disabled:opacity-50"
					></textarea>
					<div class="mt-1.5 flex items-center gap-1.5">
						<button
							type="button"
							onclick={() =>
								run('followup', async () => {
									await onSendFollowup(editingFeedbackText, {
										updateContent: true,
										replaceVersionId: entry.versionId
									});
									feedbackText = '';
									editingFeedbackIndex = null;
								})}
							disabled={busy || !editingFeedbackText.trim()}
							class="flex items-center gap-1 rounded bg-[var(--dash-primary)] px-2 py-1 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if busy && busyMode === 'followup'}
								<Spinner size="w-2.5 h-2.5" />
								Resending...
							{:else}
								Resend
							{/if}
						</button>
						<button
							type="button"
							onclick={() => {
								editingFeedbackIndex = null;
							}}
							disabled={busy}
							class="rounded border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
						>
							Cancel
						</button>
					</div>
				{:else}
					<p class="text-sm whitespace-pre-wrap text-[var(--dash-text)]">{entry.userRequest}</p>
				{/if}
			</div>
		{/if}
		<!-- AI feedback bubble (separate from version) -->
		{#if !userEntry && entry.aiFeedback}
			<div class="rounded-lg border {borderColor} {bgColor} p-3">
				<div class="mb-1 flex items-center gap-2">
					<div class="h-5 w-5 rounded-full {iconBg} flex flex-shrink-0 items-center justify-center">
						<FontAwesomeIcon icon={faRobot} class="h-2.5 w-2.5 {iconColor}" />
					</div>
					<p class="text-xs text-[var(--dash-text-muted)]">
						{entryLabel(entry)}
						{#if entry.date}
							<span class="ml-1">&middot; {formatDate(entry.date)}</span>
						{/if}
					</p>
				</div>
				<div class="ai-feedback mb-1 text-sm text-[var(--dash-text)]">
					{@html renderSafeMarkdown(entry.aiFeedback)}
				</div>
				{#if !entry.content && !isEditing && entry.type !== 'ai_advice'}
					<button
						type="button"
						onclick={() =>
							run('followup', () =>
								onSendFollowup('Please revise the text based on your feedback above.', {
									updateContent: true
								})
							)}
						disabled={busy}
						class="mt-1 flex items-center gap-1 rounded border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if busy && busyMode === 'followup'}
							<Spinner size="w-2.5 h-2.5" />
							Generating...
						{:else}
							<FontAwesomeIcon icon={faRobot} class="h-2.5 w-2.5" />
							Generate revision from this feedback
						{/if}
					</button>
				{/if}
			</div>
		{/if}
		<!-- Version box -->
		{#if entry.content}
			{@const isEditingThis = editingIndex === entryIndex}
			{@const editingPrevious = isEditingPreviousVersion()}
			{@const hasPrevious = getPreviousContent(entryIndex) !== null}
			{@const isCurrentAnswer =
				!!onApplyVersion &&
				!!entry.content &&
				entry.content.trim() === (currentContent ?? '').trim()}
			{@const showingDiff =
				!isEditingThis &&
				hasPrevious &&
				(diffShown.has(entryIndex) ||
					(!diffHidden.has(entryIndex) && shouldAutoShowDiff(entryIndex)))}
			<div
				class="{userEntry ? 'ml-6' : ''} rounded-lg border {isCurrentAnswer
					? 'border-[var(--dash-success)]'
					: borderColor} {versionBgColor}"
			>
				<div
					class="flex items-center gap-2 px-3 py-2 text-xs font-semibold tracking-wide text-[var(--dash-text-secondary)] uppercase"
				>
					{#if userEntry}
						<FontAwesomeIcon icon={faPencil} class="h-2.5 w-2.5 {iconColor}" />
					{:else}
						<FontAwesomeIcon icon={faRobot} class="h-2.5 w-2.5 {iconColor}" />
					{/if}
					Version {versionNum}{#if !userEntry}
						<span class="font-normal normal-case"
							>({versionNum === 1 ? 'AI assisted' : 'AI revised'})</span
						>{/if}
					{#if entry.date}
						<span class="font-normal text-[var(--dash-text-muted)] normal-case"
							>&middot; {formatDate(entry.date)}</span
						>
					{/if}
					{#if isEditingThis}
						<span
							class="ml-auto flex items-center gap-1 rounded-full bg-[var(--dash-primary-light)] px-2 py-0.5 font-medium text-[var(--dash-primary)] normal-case"
						>
							<FontAwesomeIcon icon={faPencil} class="h-2.5 w-2.5" />
							{#if !editChanged}
								Editing
							{:else if editingPrevious}
								Saves as version {nextVersionNum}, replacing later ones
							{:else}
								Saves as version {nextVersionNum}
							{/if}
						</span>
					{:else if isCurrentAnswer}
						<span
							class="ml-auto flex items-center gap-1 rounded-full bg-[var(--dash-success-light)] px-2 py-0.5 font-medium text-[var(--dash-success)] normal-case"
						>
							<FontAwesomeIcon icon={faCheck} class="h-2.5 w-2.5" /> Current {applyNoun}
						</span>
					{/if}
				</div>
				<div class="px-3 pb-3">
					{#if !isEditingThis && hasPrevious && !isEditing}
						<div class="mb-1 flex justify-end">
							<button
								type="button"
								onclick={() => toggleDiff(entryIndex, showingDiff)}
								class="flex items-center gap-1 rounded border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)]"
							>
								<FontAwesomeIcon icon={showingDiff ? faEyeSlash : faEye} class="h-2.5 w-2.5" />
								{showingDiff ? 'Hide changes' : 'Show changes'}
							</button>
						</div>
					{/if}
					{#if showingDiff}
						{@const prevContent = getPreviousContent(entryIndex)}
						{@const segments = computeDiff(prevContent || '', entry.content || '')}
						<pre
							class="text-xs leading-relaxed whitespace-pre-wrap text-[var(--dash-text)]">{#each segments as seg}{#if seg.type === 'added'}<span
										class="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
										>{seg.text}</span
									>{:else if seg.type === 'removed'}<span
										class="bg-red-500/20 text-red-700 line-through dark:text-red-300"
										>{seg.text}</span
									>{:else}{seg.text}{/if}{/each}</pre>
					{:else}
						<SimpleEditor
							content={entry.content || ''}
							editable={isEditingThis}
							markdown={true}
							onUpdate={(md) => {
								if (editingIndex === entryIndex) editContent = md;
							}}
						/>
					{/if}
					{#if isEditingThis}
						<div class="mt-2 flex flex-wrap items-center gap-1.5">
							{#if editingPrevious}
								<button
									type="button"
									disabled={busy || !editContent.trim()}
									onclick={saveEdit}
									class="flex items-center gap-1 rounded bg-amber-500/80 px-2 py-1 text-xs text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Save & continue here
								</button>
							{:else}
								<button
									type="button"
									disabled={busy || !editContent.trim()}
									onclick={saveEdit}
									class="flex items-center gap-1 rounded bg-[var(--dash-primary)] px-2 py-1 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
								>
									{editChanged ? `Save as version ${nextVersionNum}` : 'Save'}
								</button>
								<button
									type="button"
									disabled={busy || !editContent.trim()}
									onclick={saveEditAndReview}
									class="flex items-center gap-1 rounded border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] disabled:cursor-not-allowed disabled:opacity-50"
								>
									{#if busy && busyMode === 'review'}
										<Spinner size="w-2.5 h-2.5" />
										Reviewing…
									{:else}
										<FontAwesomeIcon icon={faRobot} class="h-2.5 w-2.5" />
										Save & AI review
									{/if}
								</button>
							{/if}
							<button
								type="button"
								onclick={cancelEdit}
								class="rounded border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
							>
								Cancel
							</button>
						</div>
					{:else if !isEditing}
						{#if hasPrevious}
							<div class="mt-2 flex justify-end">
								<button
									type="button"
									onclick={() => toggleDiff(entryIndex, showingDiff)}
									class="flex items-center gap-1 rounded border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)]"
								>
									<FontAwesomeIcon icon={showingDiff ? faEyeSlash : faEye} class="h-2.5 w-2.5" />
									{showingDiff ? 'Hide changes' : 'Show changes'}
								</button>
							</div>
						{/if}
						<div
							class="mt-2 flex items-center gap-1.5 border-t border-[var(--dash-border)]/50 pt-2"
						>
							{#if ownVersionEditor}
								<button
									type="button"
									onclick={() => startEdit(entry.content ?? '', entryIndex)}
									class="flex items-center gap-1 rounded border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)]"
								>
									<FontAwesomeIcon icon={faPencil} class="h-2.5 w-2.5" />
									Edit
								</button>
							{/if}
							{#if isLast}
								<button
									type="button"
									onclick={() => run('review', () => onReview(entry.content!))}
									disabled={busy}
									class="flex items-center gap-1 rounded border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] disabled:cursor-not-allowed disabled:opacity-50"
								>
									{#if busy && busyMode === 'review'}
										<Spinner size="w-2.5 h-2.5" />
									{:else}
										<FontAwesomeIcon icon={faRobot} class="h-2.5 w-2.5" />
									{/if}
									AI review
								</button>
							{/if}
							{#if onClearResponse && entryIndex === lastContentIndex}
								{@const isManual = entry.type === 'manual_edit'}
								<button
									type="button"
									onclick={() => run('followup', () => onClearResponse(entry.versionId))}
									disabled={busy}
									title={entry.userRequest
										? 'Delete this AI response and keep your message'
										: isManual
											? 'Delete this version'
											: 'Delete this AI response'}
									class="flex items-center gap-1 rounded border border-red-500/30 px-2 py-1 text-xs text-red-500 transition-colors hover:border-red-500/50 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
								>
									<FontAwesomeIcon icon={faTrash} class="h-2.5 w-2.5" />
									{isManual ? 'Delete version' : 'Delete response'}
								</button>
							{/if}
							{#if onApplyVersion && !isCurrentAnswer}
								<button
									type="button"
									onclick={() => run('followup', () => onApplyVersion(entry.content!))}
									disabled={busy}
									class="ml-auto flex items-center gap-1 rounded border border-[var(--dash-success)]/40 px-2 py-1 text-xs text-[var(--dash-success)] transition-colors hover:bg-[var(--dash-success-light)] disabled:cursor-not-allowed disabled:opacity-50"
								>
									<FontAwesomeIcon icon={faCheck} class="h-2.5 w-2.5" />
									Use as {applyNoun}
								</button>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/snippet}

<!-- Timeline -->
{#if conversation.length > 0}
	{#if canCollapse}
		<div class="flex justify-center">
			<button
				type="button"
				onclick={() => (userExpanded = !userExpanded)}
				class="inline-flex items-center gap-1.5 px-3 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
			>
				<FontAwesomeIcon icon={collapsed ? faChevronDown : faChevronUp} class="h-2.5 w-2.5" />
				{collapsed
					? `Show full conversation · ${hiddenTurns} earlier ${hiddenTurns === 1 ? 'turn' : 'turns'}`
					: 'Collapse · show only the latest'}
			</button>
		</div>
	{/if}
	<div class="space-y-3">
		{#each conversation as entry, i}
			{#if !collapsed || i >= lastContentIndex}
				{#if i === conversation.length - 1}
					<div bind:this={lastEntryEl} class="scroll-mt-16">
						{@render conversationEntry(entry, entryVersionNums[i], true, i)}
					</div>
				{:else}
					{@render conversationEntry(entry, entryVersionNums[i], false, i)}
				{/if}
			{/if}
		{/each}
	</div>
{/if}

<!-- Composer: the one place to either brief/message the AI or write your own
     version. Deliberately the same shape before the thread starts and after
     it — before, the box briefs the first AI turn (and may be left blank);
     after, it's a message to the AI. Which AI step runs is chosen by the
     button pressed, never by which part of the page you're in. The "my own
     version" editor stays separate so a message to the AI is never saved as
     content. -->
{#snippet composer()}
	<div class="space-y-2">
		<textarea
			bind:value={feedbackText}
			placeholder={hasThread
				? 'Message the AI — e.g. “make it more concise”, or “write it based on your advice”…'
				: autoMode
					? 'Ask for a draft or ask a question — e.g. “write it, keep it under 150 words”, or “what should I emphasize?” Leave blank for a first draft.'
					: 'Optional — tell the AI what to focus on, e.g. “keep it under 100 words”. Leave blank to let it work from your profile and the job.'}
			rows={3}
			disabled={busy}
			class="w-full resize-y rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none disabled:opacity-50"
		></textarea>
		{#if autoMode && !hasThread}
			<!-- Starter chips: the old advice/generate kept as one-tap, discoverable
         shortcuts over the single Send (which lets the model decide). -->
			<div class="flex flex-wrap items-center gap-1.5">
				<span class="text-xs text-[var(--dash-text-muted)]">Try:</span>
				<button
					type="button"
					onclick={() =>
						run('generate', async () => {
							await onGenerate('generate', feedbackText.trim() || undefined);
							feedbackText = '';
						})}
					disabled={busy}
					class="flex items-center gap-1.5 rounded-full border border-[var(--dash-border)] px-2.5 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if busy && busyMode === 'generate'}
						<Spinner size="w-2.5 h-2.5" />
						Writing…
					{:else}
						<FontAwesomeIcon icon={faPencil} class="h-2.5 w-2.5" />
						Write a draft
					{/if}
				</button>
				<button
					type="button"
					onclick={() =>
						run('advice', async () => {
							await onGenerate('advice', feedbackText.trim() || undefined);
							feedbackText = '';
						})}
					disabled={busy}
					class="flex items-center gap-1.5 rounded-full border border-[var(--dash-border)] px-2.5 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if busy && busyMode === 'advice'}
						<Spinner size="w-2.5 h-2.5" />
						Thinking…
					{:else}
						<FontAwesomeIcon icon={faComments} class="h-2.5 w-2.5" />
						Get advice
					{/if}
				</button>
			</div>
		{/if}
		<div class="flex flex-wrap items-center justify-between gap-2">
			<!-- Writing it yourself is a peer of the AI steps, not a fallback. With no
         thread yet there's nothing else on the page competing for attention,
         so it gets a full button rather than the inline link it is mid-thread.
         Hidden when the host owns the manual surface (ownVersionEditor=false). -->
			{#if ownVersionEditor}
				<button
					type="button"
					onclick={() => (composerOpen = !composerOpen)}
					class={hasThread
						? 'flex items-center gap-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]'
						: 'flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)]'}
				>
					<FontAwesomeIcon icon={faPencil} class="h-3 w-3" />
					Write / paste my own version
				</button>
			{:else}
				<span></span>
			{/if}
			{#if hasThread}
				<button
					type="button"
					onclick={() =>
						run('followup', async () => {
							await onSendFollowup(feedbackText, { updateContent: true });
							feedbackText = '';
						})}
					disabled={busy || !feedbackText.trim()}
					class="flex items-center gap-1.5 rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if busy && busyMode === 'followup'}
						<Spinner size="w-3 h-3" />
						Sending…
					{:else}
						<FontAwesomeIcon icon={faComments} class="h-3 w-3" />
						Send to AI
					{/if}
				</button>
			{:else if autoMode}
				<button
					type="button"
					onclick={() =>
						run('auto', async () => {
							await onGenerate('auto', feedbackText.trim() || undefined);
							feedbackText = '';
						})}
					disabled={busy}
					class="flex items-center gap-1.5 rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if busy && busyMode === 'auto'}
						<Spinner size="w-3 h-3" />
						Sending…
					{:else}
						<FontAwesomeIcon icon={faComments} class="h-3 w-3" />
						Send to AI
					{/if}
				</button>
			{:else}
				<div class="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onclick={() =>
							run('advice', async () => {
								await onGenerate('advice', feedbackText.trim() || undefined);
								feedbackText = '';
							})}
						disabled={busy}
						class="flex items-center gap-1.5 rounded-lg border border-[var(--dash-primary)] px-3 py-1.5 text-xs text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-primary-light)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if busy && busyMode === 'advice'}
							<Spinner size="w-3 h-3" />
							Generating…
						{:else}
							<FontAwesomeIcon icon={faComments} class="h-3 w-3" />
							AI advice
						{/if}
					</button>
					<button
						type="button"
						onclick={() =>
							run('generate', async () => {
								await onGenerate('generate', feedbackText.trim() || undefined);
								feedbackText = '';
							})}
						disabled={busy}
						class="flex items-center gap-1.5 rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if busy && busyMode === 'generate'}
							<Spinner size="w-3 h-3" />
							Generating…
						{:else}
							<FontAwesomeIcon icon={faRobot} class="h-3 w-3" />
							AI generate
						{/if}
					</button>
				</div>
			{/if}
		</div>

		{#if composerOpen}
			<div class="space-y-2 rounded-lg border border-[var(--dash-border)] p-3">
				<p class="text-xs font-medium text-[var(--dash-text-secondary)]">Your own version</p>
				<SimpleEditor bind:content={composerContent} markdown={true} {placeholder} />
				<div class="flex flex-wrap items-center justify-end gap-2">
					<button
						type="button"
						onclick={() => {
							composerOpen = false;
							composerContent = '';
						}}
						class="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={() =>
							run('review', async () => {
								await onReview(composerContent);
								composerContent = '';
								composerOpen = false;
							})}
						disabled={busy || !composerContent.trim()}
						class="flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if busy && busyMode === 'review'}
							<Spinner size="w-3 h-3" />
							Reviewing…
						{:else}
							<FontAwesomeIcon icon={faRobot} class="h-3 w-3" />
							Save &amp; AI review
						{/if}
					</button>
					<button
						type="button"
						onclick={() =>
							run('followup', async () => {
								await onSaveVersion(composerContent, {});
								composerContent = '';
								composerOpen = false;
							})}
						disabled={busy || !composerContent.trim()}
						class="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
						Save my version
					</button>
				</div>
			</div>
		{/if}
	</div>
{/snippet}

<!-- Before the first turn the composer IS the page, so it gets a card to sit
     in; once the timeline is above it, it reads as the thread's input line. -->
{#if conversation.length === 0}
	<Card padding="md">{@render composer()}</Card>
{:else}
	{@render composer()}
{/if}

<!-- Overwrite Previous Version Confirmation Modal -->
<ConfirmModal
	isOpen={showOverwriteConfirm}
	title="Save Previous Version"
	message="Saving this version will remove all feedback and versions that came after it. This cannot be undone."
	confirmLabel="Save & continue here"
	onCancel={() => {
		showOverwriteConfirm = false;
		pendingOverwrite = null;
	}}
	onConfirm={confirmOverwrite}
/>

<style>
	:global(.ai-feedback p) {
		margin-bottom: 0.5rem;
	}
	:global(.ai-feedback p:last-child) {
		margin-bottom: 0;
	}
	:global(.ai-feedback ul),
	:global(.ai-feedback ol) {
		margin: 0.5rem 0;
		padding-left: 1.5rem;
	}
	:global(.ai-feedback ul) {
		list-style-type: disc;
	}
	:global(.ai-feedback ol) {
		list-style-type: decimal;
	}
	:global(.ai-feedback li) {
		margin-bottom: 0.25rem;
	}
	:global(.ai-feedback strong) {
		font-weight: 600;
	}
	:global(.ai-feedback h1),
	:global(.ai-feedback h2),
	:global(.ai-feedback h3) {
		font-weight: 600;
		margin: 0.75rem 0 0.25rem;
	}
</style>
