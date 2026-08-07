<script lang="ts">
	import type { PageData } from './$types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCommentDots,
		faReply,
		faChevronDown,
		faChevronRight,
		faDownload,
		faShieldAlt
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../components/Card.svelte';
	import { feedbackState } from '../components/feedback-state.svelte';

	let { data }: { data: PageData } = $props();

	let feedback = $derived((data as any).feedback);

	let expandedId = $state<number | null>(null);
	let replyText = $state('');
	let submitting = $state(false);
	let replyError = $state('');

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

	const statusLabels: Record<string, string> = {
		new: 'New',
		reviewed: 'In Review',
		waiting: 'Waiting for Reply',
		resolved: 'Resolved'
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

	function toggleExpand(id: number) {
		if (expandedId === id) {
			expandedId = null;
		} else {
			expandedId = id;
			replyText = '';
			replyError = '';
		}
	}

	async function submitReply(feedbackId: number) {
		if (!replyText.trim()) return;
		submitting = true;
		replyError = '';

		try {
			const res = await fetch(`/api/feedback/${feedbackId}/reply`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: replyText.trim() })
			});
			if (!res.ok) {
				const data = await res.json().catch(() => null);
				replyError = data?.message || 'Failed to send reply.';
				return;
			}
			replyText = '';
			// Reload the page data to show the new reply
			const { invalidateAll } = await import('$app/navigation');
			await invalidateAll();
		} catch {
			replyError = 'Failed to send. Please try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<FontAwesomeIcon icon={faCommentDots} class="h-5 w-5 text-[var(--dash-primary)]" />
			<h1 class="text-lg font-semibold text-[var(--dash-text)]">My Feedback</h1>
		</div>
		<button
			type="button"
			onclick={() => {
				feedbackState.open = true;
				feedbackState.minimized = false;
			}}
			class="rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
		>
			New Feedback
		</button>
	</div>

	{#if feedback.length === 0}
		<Card padding="lg">
			<div class="py-8 text-center">
				<p class="text-sm text-[var(--dash-text-muted)]">No feedback yet.</p>
				<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
					Use the feedback widget to submit your first ticket.
				</p>
			</div>
		</Card>
	{:else}
		<div class="space-y-3">
			{#each feedback as entry (entry.id)}
				<Card padding="md">
					<div class="space-y-3">
						<!-- Clickable header -->
						<button type="button" onclick={() => toggleExpand(entry.id)} class="w-full text-left">
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
										{statusLabels[entry.status] || entry.status}
									</span>
									<span class="text-xs text-[var(--dash-text-muted)]">#{entry.id}</span>
									{#if entry.feedback_replies.length > 0}
										<span class="flex items-center gap-1 text-xs text-[var(--dash-text-muted)]">
											<FontAwesomeIcon icon={faReply} class="h-3 w-3" />
											{entry.feedback_replies.length}
										</span>
									{/if}
								</div>
								<FontAwesomeIcon
									icon={expandedId === entry.id ? faChevronDown : faChevronRight}
									class="mt-1 h-3 w-3 flex-shrink-0 text-[var(--dash-text-muted)]"
								/>
							</div>

							<!-- Message preview (collapsed) -->
							{#if expandedId !== entry.id}
								<p class="mt-2 line-clamp-2 text-sm text-[var(--dash-text)]">{entry.message}</p>
							{/if}
						</button>

						<!-- Expanded view -->
						{#if expandedId === entry.id}
							<!-- Original message -->
							<div class="pt-1">
								<p class="text-sm whitespace-pre-wrap text-[var(--dash-text)]">{entry.message}</p>
							</div>

							<!-- Attachments -->
							{#if entry.user_feedback_files?.length > 0}
								<div class="flex flex-wrap gap-2">
									{#each entry.user_feedback_files as fileRecord}
										{#if fileRecord.file}
											<a
												href="/api/feedback/{entry.id}/files?fileId={fileRecord.file.id}"
												class="flex items-center gap-1.5 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)]"
											>
												<FontAwesomeIcon icon={faDownload} class="h-3 w-3" />
												<span class="max-w-32 truncate">{fileRecord.file.filename_download}</span>
												<span class="text-[var(--dash-text-muted)]"
													>{formatFileSize(fileRecord.file.filesize)}</span
												>
											</a>
										{/if}
									{/each}
								</div>
							{/if}

							<!-- Meta -->
							<div class="text-xs text-[var(--dash-text-muted)]">
								Submitted {formatDate(entry.date_created)}
							</div>

							<!-- Reply thread -->
							{#if entry.feedback_replies.length > 0}
								<div class="space-y-3 border-t border-[var(--dash-border)] pt-3">
									{#each entry.feedback_replies as reply}
										<div class="flex gap-3 {reply.is_admin ? 'pl-0' : 'pl-0'}">
											<div
												class="flex-1 rounded-lg p-3 text-sm {reply.is_admin
													? 'border border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/30'
													: 'bg-[var(--dash-bg)]'}"
											>
												<div class="mb-1 flex items-center gap-2">
													{#if reply.is_admin}
														<span
															class="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400"
														>
															<FontAwesomeIcon icon={faShieldAlt} class="h-3 w-3" />
															Team
														</span>
													{:else}
														<span class="text-xs font-medium text-[var(--dash-text-secondary)]">
															{reply.user?.name || 'You'}
														</span>
													{/if}
													<span class="text-xs text-[var(--dash-text-muted)]"
														>{formatDate(reply.created_at)}</span
													>
												</div>
												<p class="whitespace-pre-wrap text-[var(--dash-text)]">{reply.message}</p>
											</div>
										</div>
									{/each}
								</div>
							{/if}

							<!-- Reply form -->
							{#if entry.status !== 'resolved'}
								<div class="border-t border-[var(--dash-border)] pt-3">
									<div class="flex gap-2">
										<input
											type="text"
											bind:value={replyText}
											placeholder="Write a reply..."
											onkeydown={(e) => {
												if (e.key === 'Enter' && !e.shiftKey) {
													e.preventDefault();
													submitReply(entry.id);
												}
											}}
											class="flex-1 rounded-lg border border-[var(--dash-border)] bg-transparent px-3 py-2 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
										/>
										<button
											type="button"
											onclick={() => submitReply(entry.id)}
											disabled={submitting || !replyText.trim()}
											class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
										>
											{submitting ? '...' : 'Reply'}
										</button>
									</div>
									{#if replyError}
										<p class="mt-1 text-xs text-[var(--dash-error)]">{replyError}</p>
									{/if}
								</div>
							{:else}
								<div class="border-t border-[var(--dash-border)] pt-3">
									<p class="text-center text-xs text-[var(--dash-text-muted)]">
										This ticket has been resolved.
									</p>
								</div>
							{/if}
						{/if}
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</div>
