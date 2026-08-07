<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faChevronLeft,
		faChevronRight,
		faComments,
		faRobot,
		faUser
	} from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Card from '../../components/Card.svelte';

	let { data }: { data: PageData } = $props();

	let expandedId = $state<number | null>(null);
	let expandedSection = $state<string | null>(null);
	let expandedDetail = $state<Record<string, unknown> | null>(null);
	let loadingDetail = $state(false);

	async function toggleExpand(id: number) {
		if (expandedId === id) {
			expandedId = null;
			expandedSection = null;
			expandedDetail = null;
			return;
		}

		expandedId = id;
		expandedSection = null;
		expandedDetail = null;
		loadingDetail = true;

		try {
			const res = await fetch(`/api/admin/ai-chats?id=${id}`);
			if (res.ok) {
				expandedDetail = await res.json();
			}
		} finally {
			loadingDetail = false;
		}
	}

	function toggleSection(section: string) {
		expandedSection = expandedSection === section ? null : section;
	}

	function setTypeFilter(type: string) {
		const params = new URLSearchParams();
		if (type) params.set('type', type);
		const qs = params.toString();
		goto(`/admin/ai-chats${qs ? `?${qs}` : ''}`);
	}

	function goToPage(p: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', String(p));
		goto(`/admin/ai-chats?${params.toString()}`);
	}

	function formatDate(date: Date | string | null) {
		if (!date) return '-';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatJson(value: unknown): string {
		if (!value) return '-';
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	}

	function userName(chat: (typeof data.chats)[0]): string {
		const p = chat.profile;
		if (p?.name) return p.name;
		return `Profile #${chat.profile_id}`;
	}
</script>

<div class="space-y-4">
	<SectionHeader title="AI Chats" icon={faComments} />

	<!-- Filter -->
	<div class="flex flex-col gap-2 sm:flex-row">
		<select
			value={data.requestType}
			onchange={(e) => setTypeFilter((e.target as HTMLSelectElement).value)}
			class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-sm text-[var(--dash-text)] focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
		>
			<option value="">All types ({data.total})</option>
			{#each data.requestTypes as rt}
				<option value={rt.type}>{rt.type} ({rt.count})</option>
			{/each}
		</select>
	</div>

	<!-- Results info -->
	<p class="text-xs text-[var(--dash-text-muted)]">
		Showing {(data.page - 1) * data.perPage + 1}-{Math.min(data.page * data.perPage, data.total)} of {data.total}
		records
	</p>

	<!-- Chat list -->
	<div class="space-y-2">
		{#each data.chats as chat (chat.id)}
			<Card class="overflow-hidden">
				<!-- Summary row -->
				<button
					type="button"
					onclick={() => toggleExpand(chat.id)}
					class="w-full p-3 text-left transition-colors hover:bg-[var(--dash-bg)]"
				>
					<div class="flex items-start gap-3">
						<div
							class="h-8 w-8 rounded-full {chat.error
								? 'bg-red-500/10'
								: 'bg-purple-500/10'} mt-0.5 flex flex-shrink-0 items-center justify-center"
						>
							<FontAwesomeIcon
								icon={faRobot}
								class="h-3.5 w-3.5 {chat.error ? 'text-red-500' : 'text-purple-600'}"
							/>
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<span class="text-sm font-medium text-[var(--dash-text)]">#{chat.id}</span>
								{#if chat.request_type}
									<span
										class="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400"
										>{chat.request_type}</span
									>
								{/if}
								{#if chat.followup_to}
									<span
										class="rounded-full bg-orange-500/10 px-1.5 py-0.5 text-xs text-orange-600 dark:text-orange-400"
										>followup to #{chat.followup_to}</span
									>
								{/if}
								{#if chat.error}
									<span
										class="rounded-full bg-red-500/10 px-1.5 py-0.5 text-xs text-red-600 dark:text-red-400"
										>error</span
									>
								{/if}
							</div>
							<div class="mt-1 flex items-center gap-3 text-xs text-[var(--dash-text-muted)]">
								<span>{formatDate(chat.date_created)}</span>
								<span class="flex items-center gap-1">
									<FontAwesomeIcon icon={faUser} class="h-2.5 w-2.5" />
									{userName(chat)}
								</span>
								{#if chat.model}
									<span>{chat.model}</span>
								{/if}
							</div>
						</div>
						<FontAwesomeIcon
							icon={faChevronRight}
							class="mt-2 h-3 w-3 flex-shrink-0 text-[var(--dash-text-muted)] transition-transform {expandedId ===
							chat.id
								? 'rotate-90'
								: ''}"
						/>
					</div>
				</button>

				<!-- Expanded details -->
				{#if expandedId === chat.id}
					<div class="space-y-2 border-t border-[var(--dash-border)] p-3">
						{#if loadingDetail}
							<div class="flex items-center gap-2 py-2 text-xs text-[var(--dash-text-muted)]">
								<Spinner size="w-3 h-3" />
								Loading...
							</div>
						{:else if expandedDetail}
							<!-- Metadata -->
							<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dash-text-muted)]">
								<span><strong>ID:</strong> {expandedDetail.id}</span>
								<span><strong>Profile:</strong> {expandedDetail.profile}</span>
								{#if expandedDetail.provider}<span
										><strong>Provider:</strong> {expandedDetail.provider}</span
									>{/if}
								{#if expandedDetail.model}<span><strong>Model:</strong> {expandedDetail.model}</span
									>{/if}
								{#if expandedDetail.ai_chat_template}<span
										><strong>Template:</strong> {expandedDetail.ai_chat_template}</span
									>{/if}
								{#if expandedDetail.followup_to}<span
										><strong>Followup to:</strong> #{expandedDetail.followup_to}</span
									>{/if}
							</div>

							<!-- Expandable sections -->
							{#each [{ key: 'system_prompt', label: 'System Prompt', value: expandedDetail.system_prompt as string | null }, { key: 'user_prompt', label: 'User Prompt', value: expandedDetail.user_prompt as string | null }, { key: 'full_prompt', label: 'Full Prompt', value: expandedDetail.full_prompt as string | null }, { key: 'response', label: 'Response', value: expandedDetail.response as string | null }, { key: 'context', label: 'Context', value: expandedDetail.context ? formatJson(expandedDetail.context) : null }, { key: 'error', label: 'Error', value: expandedDetail.error as string | null }] as section}
								{#if section.value}
									<div class="overflow-hidden rounded-lg border border-[var(--dash-border)]">
										<button
											type="button"
											onclick={() => toggleSection(section.key)}
											class="flex w-full items-center gap-2 bg-[var(--dash-bg)] px-3 py-2 text-left text-xs font-medium text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
										>
											<FontAwesomeIcon
												icon={faChevronRight}
												class="h-2.5 w-2.5 transition-transform {expandedSection === section.key
													? 'rotate-90'
													: ''}"
											/>
											{section.label}
											<span class="font-normal text-[var(--dash-text-muted)]"
												>({section.value.length.toLocaleString()} chars)</span
											>
										</button>
										{#if expandedSection === section.key}
											<pre
												class="max-h-96 overflow-y-auto border-t border-[var(--dash-border)] px-3 py-2 text-xs break-words whitespace-pre-wrap text-[var(--dash-text)]">{section.value}</pre>
										{/if}
									</div>
								{/if}
							{/each}
						{/if}
					</div>
				{/if}
			</Card>
		{/each}
	</div>

	<!-- Pagination -->
	{#if data.totalPages > 1}
		<div class="flex items-center justify-center gap-2">
			<button
				type="button"
				onclick={() => goToPage(data.page - 1)}
				disabled={data.page <= 1}
				class="flex items-center gap-1 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)] disabled:cursor-not-allowed disabled:opacity-30"
			>
				<FontAwesomeIcon icon={faChevronLeft} class="h-3 w-3" />
				Prev
			</button>
			<span class="text-sm text-[var(--dash-text-muted)]">
				Page {data.page} of {data.totalPages}
			</span>
			<button
				type="button"
				onclick={() => goToPage(data.page + 1)}
				disabled={data.page >= data.totalPages}
				class="flex items-center gap-1 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)] disabled:cursor-not-allowed disabled:opacity-30"
			>
				Next
				<FontAwesomeIcon icon={faChevronRight} class="h-3 w-3" />
			</button>
		</div>
	{/if}
</div>
