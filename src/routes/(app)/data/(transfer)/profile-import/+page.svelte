<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import type { ResumeData } from '$lib/server/resume/types';
	import { page } from '$app/stores';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faBug,
		faChevronDown,
		faChevronRight,
		faDownload,
		faRotateRight
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../../../components/Card.svelte';

	import StepUpload from './components/StepUpload.svelte';
	import StepDiffReview from './components/StepDiffReview.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Wizard state
	let showDiffReview = $state(false);
	let incomingData = $state<ResumeData | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(form?.error || null);

	// Current profile data from server (fall back to empty for diff)
	const emptyProfile: ResumeData = { basics: { name: '' } };
	const currentData = $derived(data.currentProfileData ?? emptyProfile);

	function handleParsed(parsed: ResumeData, source: 'upload' | 'import' | 'jsonResume') {
		incomingData = parsed;
		showDiffReview = true;
		error = null;
	}

	function handleBackFromReview() {
		showDiffReview = false;
		incomingData = null;
		error = null;
	}

	function handleError(msg: string) {
		error = msg;
	}

	function handleLoadingChange(loading: boolean) {
		isLoading = loading;
	}

	// Admin
	const isAdmin = $derived(
		($page.data.user as { is_admin?: boolean })?.is_admin || !!$page.data.adminUser
	);
	let logsOpen = $state(false);
	let expandedLogId = $state<number | null>(null);
	let reparseLogId = $state<number | null>(null);

	async function reparseFromLog(logId: number) {
		reparseLogId = logId;
		isLoading = true;
		error = null;
		try {
			const res = await fetch('/api/resume/reparse', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ logId })
			});

			if (!res.ok) {
				let message = 'Re-parse failed';
				try {
					const errData = await res.json();
					message = errData.message || errData.error || message;
				} catch {}
				error = message;
				return;
			}

			const result = await res.json();
			if (result.success && result.parsedData) {
				handleParsed(result.parsedData as ResumeData, 'upload');
			} else {
				error = 'Failed to parse file';
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Re-parse failed';
		} finally {
			isLoading = false;
			reparseLogId = null;
		}
	}

	const eventColors: Record<string, string> = {
		parse: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
		apply: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
		parse_error: 'bg-red-500/15 text-red-700 border-red-500/30',
		apply_error: 'bg-red-500/15 text-red-700 border-red-500/30'
	};

	const sectionLabels: Record<string, string> = {
		basics: 'Basics',
		work: 'Work',
		education: 'Education',
		skills: 'Skills',
		languages: 'Languages',
		projects: 'Projects',
		references: 'References'
	};

	function formatDate(iso: string) {
		const d = new Date(iso);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays < 7) return `${diffDays}d ago`;
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatSectionsCompact(sections: unknown): string {
		if (!sections || typeof sections !== 'object') return '';
		return Object.entries(sections as Record<string, number>)
			.map(([k, v]) => `${k}: ${v}`)
			.join(', ');
	}

	function formatChangesCompact(changes: unknown): string {
		if (!changes || typeof changes !== 'object') return '';
		return Object.entries(changes as Record<string, Record<string, number>>)
			.map(([section, counts]) => {
				const parts = Object.entries(counts)
					.map(([op, n]) =>
						op === 'added'
							? `+${n}`
							: op === 'removed'
								? `-${n}`
								: op === 'modified'
									? `~${n}`
									: `${op}:${n}`
					)
					.join(',');
				return `${section}(${parts})`;
			})
			.join(', ');
	}
</script>

<svelte:head>
	<title>Import - Data & Settings - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	{#if showDiffReview && incomingData}
		<StepDiffReview
			{currentData}
			{incomingData}
			{isLoading}
			{error}
			onBack={handleBackFromReview}
			onLoadingChange={handleLoadingChange}
		/>
	{:else}
		<StepUpload
			{isLoading}
			{error}
			selectedProfileName={data.selectedProfileName}
			onParsed={handleParsed}
			onError={handleError}
			onLoadingChange={handleLoadingChange}
		/>

		{#if !data.currentProfileData}
			<div class="rounded-lg border border-amber-200 bg-amber-50 p-4">
				<p class="text-sm text-amber-800">
					No profile is currently selected. Import will compare against an empty profile.
				</p>
			</div>
		{/if}
	{/if}

	<!-- Admin import logs -->
	{#if isAdmin && data.importLogs && data.importLogs.length > 0}
		<Card padding="responsive">
			<button
				type="button"
				onclick={() => (logsOpen = !logsOpen)}
				class="flex w-full items-center gap-2 text-left text-sm font-medium text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
			>
				<FontAwesomeIcon icon={faBug} class="h-3.5 w-3.5" />
				Import Logs ({data.importLogs.length})
				<FontAwesomeIcon icon={logsOpen ? faChevronDown : faChevronRight} class="ml-auto h-3 w-3" />
			</button>
			{#if logsOpen}
				<div class="mt-3 max-h-[32rem] divide-y divide-[var(--dash-border)] overflow-y-auto">
					{#each data.importLogs as log}
						{@const isExpanded = expandedLogId === log.id}
						{@const hasDetails = log.parsed_data || log.changes || log.sections || log.file_id}
						<div class="py-2">
							<!-- Summary row -->
							<button
								type="button"
								onclick={() => (expandedLogId = isExpanded ? null : log.id)}
								class="-mx-1 flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-[var(--dash-bg)]/50"
							>
								{#if hasDetails}
									<FontAwesomeIcon
										icon={isExpanded ? faChevronDown : faChevronRight}
										class="h-2.5 w-2.5 shrink-0 text-[var(--dash-text-muted)]"
									/>
								{/if}
								<span class="shrink-0 whitespace-nowrap text-[var(--dash-text-muted)]">
									{formatDate(log.date_created)}
								</span>
								<span
									class="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium {eventColors[
										log.event
									] ||
										'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}"
								>
									{log.event}
								</span>
								<span class="truncate text-[var(--dash-text-secondary)]">
									{log.user_email || 'unknown'}
								</span>
								{#if log.file_name}
									<span class="max-w-48 truncate font-medium text-[var(--dash-text)]">
										{log.file_name}
									</span>
								{/if}
								{#if log.file_format}
									<span class="text-[var(--dash-text-muted)]">
										({log.file_format})
									</span>
								{/if}
								{#if log.doc_type}
									<span
										class="shrink-0 rounded px-1 py-0.5 text-[10px] {log.doc_type === 'partial'
											? 'bg-amber-500/10 text-amber-600'
											: 'bg-emerald-500/10 text-emerald-600'}"
									>
										{log.doc_type}
									</span>
								{/if}
								{#if log.profile_id}
									<span class="text-[10px] text-[var(--dash-text-muted)]">
										profile #{log.profile_id}
									</span>
								{/if}
								{#if !isExpanded && log.sections}
									<span class="text-[10px] text-[var(--dash-text-muted)]">
										{formatSectionsCompact(log.sections)}
									</span>
								{/if}
								{#if !isExpanded && log.changes}
									<span class="text-[10px] text-[var(--dash-text-muted)]">
										{formatChangesCompact(log.changes)}
									</span>
								{/if}
								{#if log.error}
									<span class="text-[10px] break-all text-red-600">
										{log.error}
									</span>
								{/if}
							</button>

							<!-- Expanded details -->
							{#if isExpanded && hasDetails}
								<div class="mt-2 ml-5 space-y-3">
									<!-- Original file actions -->
									{#if log.file_id}
										<div class="flex flex-wrap items-center gap-3">
											<a
												href="/api/resume/reparse?logId={log.id}"
												class="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
											>
												<FontAwesomeIcon icon={faDownload} class="h-3 w-3" />
												Download
											</a>
											<button
												type="button"
												onclick={() => reparseFromLog(log.id)}
												disabled={reparseLogId === log.id}
												class="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
											>
												<FontAwesomeIcon
													icon={faRotateRight}
													class="h-3 w-3 {reparseLogId === log.id ? 'animate-spin' : ''}"
												/>
												{reparseLogId === log.id ? 'Parsing...' : 'Re-parse'}
											</button>
										</div>
									{/if}

									<!-- Sections overview (for parse events) -->
									{#if log.sections}
										<div>
											<p
												class="mb-1 text-[10px] font-medium tracking-wide text-[var(--dash-text-muted)] uppercase"
											>
												Parsed sections
											</p>
											<div class="flex flex-wrap gap-1.5">
												{#each Object.entries(log.sections as Record<string, number>) as [name, count]}
													<span
														class="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700"
													>
														{sectionLabels[name] || name}: {count}
													</span>
												{/each}
												<!-- Show absent sections -->
												{#each ['work', 'education', 'skills', 'languages', 'projects', 'references'] as name}
													{#if !(log.sections as Record<string, unknown>)[name]}
														<span
															class="rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-0.5 text-xs text-[var(--dash-text-muted)]"
														>
															{sectionLabels[name]}: absent
														</span>
													{/if}
												{/each}
											</div>
										</div>
									{/if}

									<!-- Changes overview (for apply events) -->
									{#if log.changes}
										<div>
											<p
												class="mb-1 text-[10px] font-medium tracking-wide text-[var(--dash-text-muted)] uppercase"
											>
												Applied changes
											</p>
											<div class="flex flex-wrap gap-1.5">
												{#each Object.entries(log.changes as Record<string, Record<string, number>>) as [section, counts]}
													<span
														class="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700"
													>
														{sectionLabels[section] || section}:
														{#each Object.entries(counts) as [op, n], i}
															{#if i > 0},{/if}
															{op === 'added'
																? `+${n}`
																: op === 'removed'
																	? `-${n}`
																	: op === 'modified'
																		? `~${n}`
																		: `${op}:${n}`}
														{/each}
													</span>
												{/each}
											</div>
										</div>
									{/if}

									<!-- Parsed data (for parse events) -->
									{#if log.parsed_data}
										<div>
											<p
												class="mb-1 text-[10px] font-medium tracking-wide text-[var(--dash-text-muted)] uppercase"
											>
												Parsed JSON
											</p>
											<pre
												class="max-h-60 overflow-x-auto overflow-y-auto rounded-lg bg-[var(--dash-bg)] p-3 text-[10px] text-[var(--dash-text-secondary)]">{JSON.stringify(
													log.parsed_data,
													null,
													2
												)}</pre>
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</Card>
	{/if}
</div>
