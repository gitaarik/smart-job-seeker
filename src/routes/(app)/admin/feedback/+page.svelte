<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCommentDots,
		faTrash,
		faExternalLinkAlt,
		faDownload,
		faStickyNote,
		faReply,
		faShieldAlt,
		faCodeBranch
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../../components/Card.svelte';
	import ConfirmModal from '../../profile/components/ConfirmModal.svelte';

	let { data }: { data: PageData } = $props();

	let feedback = $derived((data as any).feedback);
	let counts = $derived((data as any).counts);
	let statusFilter = $derived((data as any).statusFilter);
	let categoryFilter = $derived((data as any).categoryFilter);

	let deleteId = $state<number | null>(null);
	let editingNoteId = $state<number | null>(null);
	let noteText = $state('');
	let replyingToId = $state<number | null>(null);
	let replyText = $state('');
	let mergingId = $state<number | null>(null);
	let mergeTargetId = $state('');

	let statusTabs = $derived([
		{ value: '', label: 'All', count: counts.all },
		{ value: 'new', label: 'New', count: counts.new },
		{ value: 'reviewed', label: 'Reviewed', count: counts.reviewed },
		{ value: 'waiting', label: 'Waiting', count: counts.waiting },
		{ value: 'resolved', label: 'Resolved', count: counts.resolved }
	]);

	const categoryLabels: Record<string, string> = {
		bug: 'Bug',
		feature: 'Feature',
		ui: 'UI / Design',
		question: 'Question',
		other: 'Other'
	};

	const categoryColors: Record<string, string> = {
		bug: 'bg-red-100 text-red-700',
		feature: 'bg-blue-100 text-blue-700',
		ui: 'bg-purple-100 text-purple-700',
		question: 'bg-amber-100 text-amber-700',
		other: 'bg-gray-100 text-gray-600'
	};

	const statusColors: Record<string, string> = {
		new: 'bg-yellow-100 text-yellow-700',
		reviewed: 'bg-blue-100 text-blue-700',
		waiting: 'bg-orange-100 text-orange-700',
		resolved: 'bg-green-100 text-green-700'
	};

	function formatDate(date: string | Date | null): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatFileSize(bytes: number | bigint | null): string {
		if (!bytes) return '';
		const n = Number(bytes);
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		return `${(n / (1024 * 1024)).toFixed(1)} MB`;
	}

	function startEditNote(id: number, currentNote: string | null) {
		editingNoteId = id;
		noteText = currentNote || '';
	}

	function startReply(id: number) {
		replyingToId = id;
		replyText = '';
	}

	function startMerge(id: number) {
		mergingId = id;
		mergeTargetId = '';
	}
</script>

<div class="space-y-6">
	<div class="flex items-center gap-2">
		<FontAwesomeIcon icon={faCommentDots} class="h-5 w-5 text-[var(--dash-primary)]" />
		<h1 class="text-lg font-semibold text-[var(--dash-text)]">User Feedback</h1>
	</div>

	<!-- Status filter tabs -->
	<div class="flex flex-wrap gap-2">
		{#each statusTabs as tab}
			<a
				href="/admin/feedback{tab.value ? `?status=${tab.value}` : ''}{categoryFilter
					? `${tab.value ? '&' : '?'}category=${categoryFilter}`
					: ''}"
				class="rounded-lg border px-3 py-1.5 text-sm transition-colors {statusFilter === tab.value
					? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 font-medium text-[var(--dash-primary)]'
					: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
			>
				{tab.label}
				<span class="ml-1 text-xs opacity-70">{tab.count}</span>
			</a>
		{/each}
	</div>

	<!-- Category filter -->
	<div class="flex flex-wrap gap-1.5">
		<a
			href="/admin/feedback{statusFilter ? `?status=${statusFilter}` : ''}"
			class="rounded-full border px-2 py-0.5 text-xs transition-colors {!categoryFilter
				? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
				: 'border-[var(--dash-border)] text-[var(--dash-text-muted)] hover:border-[var(--dash-text-muted)]'}"
			>All categories</a
		>
		{#each Object.entries(categoryLabels) as [value, label]}
			<a
				href="/admin/feedback?{statusFilter ? `status=${statusFilter}&` : ''}category={value}"
				class="rounded-full border px-2 py-0.5 text-xs transition-colors {categoryFilter === value
					? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
					: 'border-[var(--dash-border)] text-[var(--dash-text-muted)] hover:border-[var(--dash-text-muted)]'}"
				>{label}</a
			>
		{/each}
	</div>

	<!-- Feedback list -->
	{#if feedback.length === 0}
		<Card padding="lg">
			<p class="py-8 text-center text-sm text-[var(--dash-text-muted)]">No feedback yet.</p>
		</Card>
	{:else}
		<div class="space-y-3">
			{#each feedback as entry (entry.id)}
				<Card padding="md">
					<div class="space-y-3">
						<!-- Header row -->
						<div class="flex items-start justify-between gap-3">
							<div class="flex min-w-0 flex-wrap items-center gap-2">
								<span
									class="rounded-full px-2 py-0.5 text-xs {categoryColors[entry.category] ||
										categoryColors.other}"
								>
									{categoryLabels[entry.category] || entry.category}
								</span>
								<span
									class="rounded-full px-2 py-0.5 text-xs {statusColors[entry.status] ||
										statusColors.new}"
								>
									{entry.status}
								</span>
								<span class="text-xs text-[var(--dash-text-muted)]">#{entry.id}</span>
								{#if entry.merged_into_id}
									<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
										Merged into #{entry.merged_into_id}
									</span>
								{/if}
								{#if entry.merged_from?.length > 0}
									<span
										class="text-xs text-[var(--dash-text-muted)]"
										title="Tickets merged into this one: {entry.merged_from
											.map((m: any) => '#' + m.id)
											.join(', ')}"
									>
										<FontAwesomeIcon icon={faCodeBranch} class="inline h-3 w-3" />
										{entry.merged_from.length} merged
									</span>
								{/if}
								{#if entry.feedback_replies?.length > 0}
									<span class="flex items-center gap-1 text-xs text-[var(--dash-text-muted)]">
										<FontAwesomeIcon icon={faReply} class="h-3 w-3" />
										{entry.feedback_replies.length}
									</span>
								{/if}
							</div>
							<button
								type="button"
								onclick={() => (deleteId = entry.id)}
								class="flex-shrink-0 p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-error)]"
								aria-label="Delete"
							>
								<FontAwesomeIcon icon={faTrash} class="h-3.5 w-3.5" />
							</button>
						</div>

						<!-- Message -->
						<p class="text-sm whitespace-pre-wrap text-[var(--dash-text)]">{entry.message}</p>

						<!-- Attachments -->
						{#if entry.user_feedback_files?.length > 0}
							<div class="flex flex-wrap gap-2">
								{#each entry.user_feedback_files as fileRecord}
									{#if fileRecord.files}
										<a
											href="/admin/feedback?fileId={fileRecord.files.id}&feedbackId={entry.id}"
											class="flex items-center gap-1.5 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)]"
										>
											<FontAwesomeIcon icon={faDownload} class="h-3 w-3" />
											<span class="max-w-32 truncate">{fileRecord.files.filename_download}</span>
											<span class="text-[var(--dash-text-muted)]"
												>{formatFileSize(fileRecord.files.filesize)}</span
											>
										</a>
									{/if}
								{/each}
							</div>
						{/if}

						<!-- Meta row -->
						<div
							class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--dash-text-muted)]"
						>
							<span>{entry.user?.name || entry.user?.email}</span>
							<span>{formatDate(entry.date_created)}</span>
							{#if entry.page_url}
								<a
									href={entry.page_url}
									class="flex items-center gap-1 text-[var(--dash-primary)] hover:underline"
								>
									<FontAwesomeIcon icon={faExternalLinkAlt} class="h-2.5 w-2.5" />
									{entry.page_url}
								</a>
							{/if}
							{#if entry.subscribers?.length > 0}
								<span
									>{entry.subscribers.length} subscriber{entry.subscribers.length !== 1
										? 's'
										: ''}</span
								>
							{/if}
						</div>

						<!-- Reply thread -->
						{#if entry.feedback_replies?.length > 0}
							<div class="space-y-2 border-t border-[var(--dash-border)] pt-3">
								{#each entry.feedback_replies as reply}
									<div
										class="rounded-lg p-2.5 text-sm {reply.is_admin
											? 'border border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/30'
											: 'bg-[var(--dash-bg)]'}"
									>
										<div class="mb-1 flex items-center gap-2">
											{#if reply.is_admin}
												<span
													class="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400"
												>
													<FontAwesomeIcon icon={faShieldAlt} class="h-3 w-3" />
													{reply.user?.name || 'Admin'}
												</span>
											{:else}
												<span class="text-xs font-medium text-[var(--dash-text-secondary)]">
													{reply.user?.name || reply.user?.email || 'User'}
												</span>
											{/if}
											<span class="text-xs text-[var(--dash-text-muted)]"
												>{formatDate(reply.created_at)}</span
											>
										</div>
										<p class="whitespace-pre-wrap text-[var(--dash-text)]">{reply.message}</p>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Admin note (internal) -->
						{#if editingNoteId === entry.id}
							<form
								method="POST"
								action="?/addNote"
								use:enhance={() => {
									return async ({ update }) => {
										editingNoteId = null;
										await update();
									};
								}}
							>
								<input type="hidden" name="id" value={entry.id} />
								<div class="flex gap-2">
									<input
										name="note"
										value={noteText}
										oninput={(e) => (noteText = (e.currentTarget as HTMLInputElement).value)}
										placeholder="Internal note (not visible to user)..."
										class="flex-1 rounded border border-[var(--dash-border)] px-2 py-1 text-xs focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
									<button
										type="submit"
										class="rounded bg-[var(--dash-primary)] px-2 py-1 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
										>Save</button
									>
									<button
										type="button"
										onclick={() => (editingNoteId = null)}
										class="rounded border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)]"
										>Cancel</button
									>
								</div>
							</form>
						{:else if entry.admin_note}
							<div
								class="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs dark:border-amber-800/30 dark:bg-amber-950/20"
							>
								<FontAwesomeIcon
									icon={faStickyNote}
									class="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-500"
								/>
								<span class="text-[var(--dash-text-secondary)]"
									><span class="font-medium text-amber-600 dark:text-amber-400">Internal:</span>
									{entry.admin_note}</span
								>
								<button
									type="button"
									onclick={() => startEditNote(entry.id, entry.admin_note)}
									class="ml-auto flex-shrink-0 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)]"
									>edit</button
								>
							</div>
						{/if}

						<!-- Reply form -->
						{#if replyingToId === entry.id}
							<form
								method="POST"
								action="?/reply"
								use:enhance={() => {
									return async ({ update }) => {
										replyingToId = null;
										replyText = '';
										await update();
									};
								}}
							>
								<input type="hidden" name="id" value={entry.id} />
								<div class="flex gap-2">
									<input
										name="message"
										bind:value={replyText}
										placeholder="Reply to user (they will see this)..."
										class="flex-1 rounded border border-blue-300 bg-blue-50/50 px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-blue-700 dark:bg-blue-950/20"
									/>
									<button
										type="submit"
										disabled={!replyText.trim()}
										class="rounded bg-blue-600 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
										>Reply</button
									>
									<button
										type="button"
										onclick={() => (replyingToId = null)}
										class="rounded border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)]"
										>Cancel</button
									>
								</div>
							</form>
						{/if}

						<!-- Merge form -->
						{#if mergingId === entry.id}
							<form
								method="POST"
								action="?/merge"
								use:enhance={() => {
									return async ({ update }) => {
										mergingId = null;
										mergeTargetId = '';
										await update();
									};
								}}
							>
								<input type="hidden" name="sourceId" value={entry.id} />
								<div class="flex items-center gap-2">
									<span class="text-xs text-[var(--dash-text-muted)]">Merge into ticket #</span>
									<input
										name="targetId"
										bind:value={mergeTargetId}
										placeholder="ID"
										type="number"
										class="w-20 rounded border border-[var(--dash-border)] px-2 py-1 text-xs focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
									<button
										type="submit"
										disabled={!mergeTargetId}
										class="rounded bg-[var(--dash-primary)] px-2 py-1 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
										>Merge</button
									>
									<button
										type="button"
										onclick={() => (mergingId = null)}
										class="rounded border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)]"
										>Cancel</button
									>
								</div>
							</form>
						{/if}

						<!-- Actions -->
						<div class="flex items-center gap-2 border-t border-[var(--dash-border)] pt-1">
							{#each ['new', 'reviewed', 'waiting', 'resolved'] as s}
								{#if entry.status !== s}
									<form method="POST" action="?/updateStatus" use:enhance class="inline">
										<input type="hidden" name="id" value={entry.id} />
										<input type="hidden" name="status" value={s} />
										<button
											type="submit"
											class="text-xs text-[var(--dash-text-secondary)] capitalize transition-colors hover:text-[var(--dash-primary)]"
										>
											{s === 'new'
												? 'Reopen'
												: s === 'reviewed'
													? 'Mark reviewed'
													: s === 'waiting'
														? 'Set waiting'
														: 'Resolve'}
										</button>
									</form>
								{/if}
							{/each}
							<div class="ml-auto flex items-center gap-2">
								{#if replyingToId !== entry.id}
									<button
										type="button"
										onclick={() => startReply(entry.id)}
										class="text-xs text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400"
									>
										Reply
									</button>
								{/if}
								{#if !entry.merged_into_id && mergingId !== entry.id}
									<button
										type="button"
										onclick={() => startMerge(entry.id)}
										class="text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
									>
										Merge
									</button>
								{/if}
								{#if editingNoteId !== entry.id}
									<button
										type="button"
										onclick={() => startEditNote(entry.id, entry.admin_note)}
										class="text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
									>
										{entry.admin_note ? 'Edit note' : 'Add note'}
									</button>
								{/if}
							</div>
						</div>
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</div>

<!-- Delete Confirmation -->
<ConfirmModal
	isOpen={deleteId !== null}
	title="Delete Feedback"
	message="Delete this feedback entry and its attachments? This cannot be undone."
	onCancel={() => (deleteId = null)}
	onConfirm={() => {
		if (deleteId !== null) {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '?/delete';
			const input = document.createElement('input');
			input.type = 'hidden';
			input.name = 'id';
			input.value = String(deleteId);
			form.appendChild(input);
			document.body.appendChild(form);
			form.submit();
		}
	}}
/>
