<script lang="ts">
	import { page } from '$app/stores';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCommentDots,
		faMinus,
		faPaperclip,
		faPaperPlane,
		faCheck,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import { feedbackState } from './feedback-state.svelte';

	let isOpen = $derived(feedbackState.open);
	let isMinimized = $derived(feedbackState.minimized);
	let message = $state('');
	let category = $state('other');
	let files = $state<File[]>([]);
	let submitting = $state(false);
	let submitted = $state(false);
	let errorMsg = $state('');

	let hasDraft = $derived(message.trim().length > 0 || files.length > 0);

	const categories = [
		{ value: 'bug', label: 'Bug' },
		{ value: 'feature', label: 'Feature' },
		{ value: 'ui', label: 'UI / Design' },
		{ value: 'question', label: 'Question' },
		{ value: 'other', label: 'Other' }
	];

	function reset() {
		message = '';
		category = 'other';
		files = [];
		errorMsg = '';
	}

	function minimize() {
		feedbackState.open = false;
		feedbackState.minimized = true;
	}

	function restore() {
		feedbackState.minimized = false;
		feedbackState.open = true;
	}

	function close() {
		feedbackState.open = false;
		feedbackState.minimized = false;
		if (submitted) {
			submitted = false;
		}
		reset();
	}

	function removeFile(index: number) {
		files = files.filter((_, i) => i !== index);
	}

	async function submit() {
		if (!message.trim()) {
			errorMsg = 'Please enter a message.';
			return;
		}
		errorMsg = '';
		submitting = true;

		const formData = new FormData();
		formData.set('message', message.trim());
		formData.set('category', category);
		formData.set('page_url', $page.url.pathname + $page.url.search);
		const profileId = ($page.data as any).selectedProfile?.id;
		if (profileId) formData.set('profile_id', String(profileId));
		for (const file of files) {
			formData.append('files', file);
		}

		try {
			const res = await fetch('/api/feedback', {
				method: 'POST',
				body: formData
			});
			if (!res.ok) {
				const data = await res.json().catch(() => null);
				errorMsg = data?.message || 'Something went wrong.';
				return;
			}
			submitted = true;
		} catch {
			errorMsg = 'Failed to send. Please try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<!-- Minimized pill — shows when there's a draft -->
{#if isMinimized && hasDraft}
	<button
		type="button"
		onclick={restore}
		class="fixed right-6 bottom-6 z-40 flex items-center gap-2 rounded-full bg-[var(--dash-primary)] px-3 py-2 text-white shadow-lg transition-all hover:scale-105 hover:bg-[var(--dash-primary-hover)] max-lg:right-4 max-lg:bottom-4"
		aria-label="Restore feedback draft"
	>
		<FontAwesomeIcon icon={faCommentDots} class="h-4 w-4" />
		<span class="text-xs font-medium">Draft saved</span>
	</button>
{/if}

<!-- Feedback panel -->
{#if isOpen}
	<!-- Backdrop -->
	<button
		type="button"
		class="fixed inset-0 z-30 bg-black/40"
		onclick={minimize}
		aria-label="Minimize feedback"
	></button>

	<div
		class="fixed right-6 bottom-6 z-40 w-96 rounded-xl bg-[var(--dash-card)] shadow-[0_0_30px_rgba(0,0,0,0.3)] ring-[3px] ring-[var(--dash-primary)]/60 max-lg:inset-x-4 max-lg:top-1/2 max-lg:bottom-auto max-lg:w-auto max-lg:-translate-y-1/2"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-[var(--dash-border)] px-4 py-3">
			<h3 class="text-sm font-semibold text-[var(--dash-text)]">Send Feedback</h3>
			<button
				type="button"
				onclick={minimize}
				class="p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
				aria-label="Minimize"
			>
				<FontAwesomeIcon icon={faMinus} class="h-4 w-4" />
			</button>
		</div>

		<div class="p-4">
			{#if submitted}
				<!-- Success state -->
				<div class="py-6 text-center">
					<div
						class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600"
					>
						<FontAwesomeIcon icon={faCheck} class="h-6 w-6" />
					</div>
					<p class="text-sm font-medium text-[var(--dash-text)]">Thanks for your feedback!</p>
					<p class="mt-1 text-xs text-[var(--dash-text-muted)]">We'll look into it.</p>
					<div class="mt-4 flex items-center justify-center gap-3">
						<a
							href="/feedback"
							onclick={close}
							class="rounded-lg px-4 py-1.5 text-sm text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-primary)]/10"
						>
							View your feedback
						</a>
						<button
							type="button"
							onclick={close}
							class="rounded-lg px-4 py-1.5 text-sm text-[var(--dash-text-muted)] transition-colors hover:bg-[var(--dash-bg)]"
						>
							Close
						</button>
					</div>
				</div>
			{:else}
				<!-- Category selector -->
				<div class="mb-3 flex flex-wrap gap-1.5">
					{#each categories as cat}
						<button
							type="button"
							onclick={() => (category = cat.value)}
							class="rounded-full border px-2.5 py-1 text-xs transition-colors {category ===
							cat.value
								? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 font-medium text-[var(--dash-primary)]'
								: 'border-[var(--dash-border)] text-[var(--dash-text-muted)] hover:border-[var(--dash-text-muted)]'}"
						>
							{cat.label}
						</button>
					{/each}
				</div>

				<!-- Message -->
				<textarea
					bind:value={message}
					placeholder="What's on your mind?"
					rows="4"
					class="w-full resize-none rounded-lg border border-[var(--dash-border)] bg-transparent px-3 py-2 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				></textarea>

				<!-- Attached files -->
				{#if files.length > 0}
					<div class="mt-2 space-y-1">
						{#each files as file, i}
							<div
								class="flex items-center justify-between rounded bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-secondary)]"
							>
								<span class="mr-2 truncate">{file.name}</span>
								<button
									type="button"
									onclick={() => removeFile(i)}
									class="flex-shrink-0 text-[var(--dash-text-muted)] hover:text-[var(--dash-error)]"
								>
									<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
								</button>
							</div>
						{/each}
					</div>
				{/if}

				{#if errorMsg}
					<p class="mt-2 text-xs text-[var(--dash-error)]">{errorMsg}</p>
				{/if}

				<!-- Actions -->
				<div class="mt-3 flex items-center justify-between">
					<label
						class="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)]"
					>
						<FontAwesomeIcon icon={faPaperclip} class="h-3.5 w-3.5" />
						Attach
						<input
							type="file"
							multiple
							accept="image/*,video/*,.pdf"
							class="hidden"
							onchange={(e) => {
								const input = e.currentTarget as HTMLInputElement;
								if (input.files) {
									files = [...files, ...Array.from(input.files)].slice(0, 5);
									input.value = '';
								}
							}}
						/>
					</label>
					<button
						type="button"
						onclick={submit}
						disabled={submitting || !message.trim()}
						class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-1.5 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if submitting}
							Sending...
						{:else}
							<FontAwesomeIcon icon={faPaperPlane} class="h-3.5 w-3.5" />
							Send
						{/if}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
