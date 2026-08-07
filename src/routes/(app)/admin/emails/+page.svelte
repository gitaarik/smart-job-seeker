<script lang="ts">
	import type { PageData } from './$types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faPaperPlane,
		faChevronDown,
		faChevronUp,
		faExclamationTriangle,
		faCheckCircle
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../../components/Card.svelte';

	let { data }: { data: PageData } = $props();

	let emails = $derived((data as any).emails);
	let typeCounts = $derived((data as any).typeCounts as Record<string, number>);
	let allCount = $derived((data as any).allCount as number);
	let sentCount = $derived((data as any).sentCount as number);
	let failedCount = $derived((data as any).failedCount as number);
	let page = $derived((data as any).page as number);
	let totalPages = $derived((data as any).totalPages as number);
	let total = $derived((data as any).total as number);
	let typeFilter = $derived((data as any).typeFilter as string);
	let statusFilter = $derived((data as any).statusFilter as string);

	let expandedId = $state<number | null>(null);
	let showHtml = $state(false);

	const typeLabels: Record<string, string> = {
		digest: 'Digest',
		verification: 'Verification',
		password_reset: 'Password Reset',
		email_change: 'Email Change',
		welcome: 'Welcome',
		admin_notification: 'Admin',
		invite: 'Invite',
		unknown: 'Unknown'
	};

	const typeColors: Record<string, string> = {
		digest: 'bg-blue-100 text-blue-700',
		verification: 'bg-yellow-100 text-yellow-700',
		password_reset: 'bg-orange-100 text-orange-700',
		email_change: 'bg-purple-100 text-purple-700',
		welcome: 'bg-green-100 text-green-700',
		admin_notification: 'bg-red-100 text-red-700',
		invite: 'bg-teal-100 text-teal-700',
		unknown: 'bg-gray-100 text-gray-600'
	};

	const statusColors: Record<string, string> = {
		sent: 'bg-green-100 text-green-700',
		failed: 'bg-red-100 text-red-700'
	};

	let typeTabs = $derived([
		{ value: '', label: 'All', count: allCount },
		...Object.entries(typeCounts)
			.sort(([, a], [, b]) => b - a)
			.map(([type, count]) => ({
				value: type,
				label: typeLabels[type] || type,
				count
			}))
	]);

	function formatDate(date: string | Date | null): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function filterUrl(params: Record<string, string>): string {
		const parts = [];
		for (const [k, v] of Object.entries(params)) {
			if (v) parts.push(`${k}=${v}`);
		}
		return `/admin/emails${parts.length ? '?' + parts.join('&') : ''}`;
	}

	function toggleExpand(id: number) {
		if (expandedId === id) {
			expandedId = null;
			showHtml = false;
		} else {
			expandedId = id;
			showHtml = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center gap-2">
		<FontAwesomeIcon icon={faPaperPlane} class="h-5 w-5 text-[var(--dash-primary)]" />
		<h1 class="text-lg font-semibold text-[var(--dash-text)]">Sent Emails</h1>
		<span class="text-sm text-[var(--dash-text-muted)]">({total})</span>
	</div>

	<!-- Type filter tabs -->
	<div class="flex flex-wrap gap-2">
		{#each typeTabs as tab}
			<a
				href={filterUrl({ type: tab.value, status: statusFilter })}
				class="rounded-lg border px-3 py-1.5 text-sm transition-colors {typeFilter === tab.value
					? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 font-medium text-[var(--dash-primary)]'
					: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
			>
				{tab.label}
				<span class="ml-1 text-xs opacity-70">{tab.count}</span>
			</a>
		{/each}
	</div>

	<!-- Status filter -->
	<div class="flex flex-wrap gap-1.5">
		{#each [{ value: '', label: 'All statuses', count: allCount }, { value: 'sent', label: 'Sent', count: sentCount }, { value: 'failed', label: 'Failed', count: failedCount }] as tab}
			<a
				href={filterUrl({ type: typeFilter, status: tab.value })}
				class="rounded-full border px-2 py-0.5 text-xs transition-colors {statusFilter === tab.value
					? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
					: 'border-[var(--dash-border)] text-[var(--dash-text-muted)] hover:border-[var(--dash-text-muted)]'}"
				>{tab.label} <span class="opacity-70">{tab.count}</span></a
			>
		{/each}
	</div>

	<!-- Email list -->
	{#if emails.length === 0}
		<Card padding="lg">
			<p class="py-8 text-center text-sm text-[var(--dash-text-muted)]">No sent emails yet.</p>
		</Card>
	{:else}
		<div class="space-y-2">
			{#each emails as email (email.id)}
				<Card padding="sm">
					<div class="space-y-2">
						<!-- Header row -->
						<button
							type="button"
							onclick={() => toggleExpand(email.id)}
							class="flex w-full items-start gap-3 text-left"
						>
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-1.5">
									<span
										class="rounded px-1.5 py-0.5 text-xs {typeColors[email.type] ||
											typeColors.unknown}"
									>
										{typeLabels[email.type] || email.type}
									</span>
									{#if email.status === 'failed'}
										<span
											class="rounded px-1.5 py-0.5 text-xs {statusColors.failed} flex items-center gap-1"
										>
											<FontAwesomeIcon icon={faExclamationTriangle} class="h-2.5 w-2.5" />
											failed
										</span>
									{/if}
								</div>
								<p class="mt-1 truncate text-sm font-medium text-[var(--dash-text)]">
									{email.subject || '(no subject)'}
								</p>
								<div class="mt-0.5 flex items-center gap-3 text-xs text-[var(--dash-text-muted)]">
									<span>To: {email.to}</span>
									<span>{formatDate(email.sent_at)}</span>
								</div>
							</div>
							<FontAwesomeIcon
								icon={expandedId === email.id ? faChevronUp : faChevronDown}
								class="mt-1 h-3.5 w-3.5 flex-shrink-0 text-[var(--dash-text-muted)]"
							/>
						</button>

						<!-- Expanded details -->
						{#if expandedId === email.id}
							<div class="space-y-3 border-t border-[var(--dash-border)] pt-2">
								<!-- Error message if failed -->
								{#if email.error}
									<div class="rounded border border-red-200 bg-red-50 p-2">
										<p class="text-xs font-medium text-red-700">Error:</p>
										<p class="mt-0.5 text-xs text-red-600">{email.error}</p>
									</div>
								{/if}

								<!-- Metadata -->
								{#if email.metadata}
									<div class="rounded bg-[var(--dash-bg)] p-2">
										<p class="mb-1 text-xs font-medium text-[var(--dash-text-secondary)]">
											Metadata:
										</p>
										<pre
											class="text-xs whitespace-pre-wrap text-[var(--dash-text-muted)]">{JSON.stringify(
												email.metadata,
												null,
												2
											)}</pre>
									</div>
								{/if}

								<!-- Body toggle and content -->
								<div class="space-y-1">
									<div class="flex gap-2">
										<button
											type="button"
											onclick={() => (showHtml = true)}
											class="rounded px-2 py-0.5 text-xs transition-colors {showHtml
												? 'bg-[var(--dash-primary)]/10 font-medium text-[var(--dash-primary)]'
												: 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)]'}"
											>Preview</button
										>
										<button
											type="button"
											onclick={() => (showHtml = false)}
											class="rounded px-2 py-0.5 text-xs transition-colors {!showHtml
												? 'bg-[var(--dash-primary)]/10 font-medium text-[var(--dash-primary)]'
												: 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)]'}"
											>Source</button
										>
									</div>
									{#if showHtml}
										<iframe
											srcdoc={email.html}
											sandbox=""
											class="h-64 w-full rounded border border-[var(--dash-border)] bg-white"
											title="Email preview"
										></iframe>
									{:else}
										<pre
											class="max-h-64 overflow-auto rounded bg-[var(--dash-bg)] p-2 text-xs whitespace-pre-wrap text-[var(--dash-text-secondary)]">{email.html}</pre>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				</Card>
			{/each}
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="flex items-center justify-center gap-2 pt-2">
				{#if page > 1}
					<a
						href={filterUrl({ type: typeFilter, status: statusFilter, page: String(page - 1) })}
						class="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-text-muted)]"
						>Previous</a
					>
				{/if}
				<span class="text-sm text-[var(--dash-text-muted)]">
					Page {page} of {totalPages}
				</span>
				{#if page < totalPages}
					<a
						href={filterUrl({ type: typeFilter, status: statusFilter, page: String(page + 1) })}
						class="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-text-muted)]"
						>Next</a
					>
				{/if}
			</div>
		{/if}
	{/if}
</div>
