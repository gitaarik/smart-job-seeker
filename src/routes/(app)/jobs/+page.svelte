<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { navigating } from '$app/stores';
	import { tick } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faBan,
		faBookmark,
		faBriefcase,
		faCalendarDays,
		faCheck,
		faChevronDown,
		faChevronLeft,
		faChevronRight,
		faEllipsisVertical,
		faGauge,
		faGlobe,
		faListCheck,
		faLocationDot,
		faSearch,
		faSitemap,
		faStar as faStarSolid,
		faSync,
		faTag,
		faTimes,
		faUser
	} from '@fortawesome/free-solid-svg-icons';
	import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import SectionHeader from '../profile/components/SectionHeader.svelte';
	import EmptyState from '../profile/components/EmptyState.svelte';
	import JobCard from './components/JobCard.svelte';
	import SkillPill from './components/SkillPill.svelte';
	import ConfirmModal from '../profile/components/ConfirmModal.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let isStaff = $derived(!!(data as any).user?.is_staff || !!(data as any).user?.is_admin);
	let isClearingMatches = $state(false);
	let clearMatchResult = $state<{ count: number } | null>(null);
	let showClearMatchConfirm = $state(false);
	let clearMatchFormEl: HTMLFormElement;
	let showAdvancedMenu = $state(false);

	let platforms = $derived(data.platforms);
	let totalCount = $derived(data.totalCount);
	let totalPages = $derived(data.totalPages);
	let filters = $derived(data.filters);

	// Infinite scroll: jobs + matches accumulate across pages. They reset when
	// the server load returns a fresh first page (filters/sort changed) and grow
	// as loadMore() appends. Plain objects so Svelte 5 tracks property access.
	let jobs = $state<typeof data.jobs>([]);
	let matchesByJobId = $state<typeof data.matchesByJobId>({});
	let savedJobIds = $state<Record<number, boolean>>({});
	let rejectedJobIds = $state<Record<number, boolean>>({});
	let currentPage = $state(1);
	let loadingMore = $state(false);

	// Reset the accumulator whenever fresh server data arrives. Reads only
	// data.* so appends (which mutate the locals) don't retrigger it.
	$effect(() => {
		jobs = [...data.jobs];
		matchesByJobId = { ...data.matchesByJobId };
		savedJobIds = Object.fromEntries(data.savedJobIds.map((id: number) => [id, true]));
		rejectedJobIds = Object.fromEntries(data.rejectedJobIds.map((id: number) => [id, true]));
		currentPage = data.currentPage;
	});

	let hasMore = $derived(currentPage < totalPages);

	async function loadMore() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		try {
			const nextPage = currentPage + 1;
			const res = await fetch(`/jobs/list${buildUrl({ page: String(nextPage) })}`);
			if (!res.ok) return;
			const more = await res.json();
			jobs = [...jobs, ...more.jobs];
			matchesByJobId = { ...matchesByJobId, ...more.matchesByJobId };
			for (const id of more.savedJobIds as number[]) savedJobIds[id] = true;
			for (const id of more.rejectedJobIds as number[]) {
				rejectedJobIds[id] = true;
			}
			currentPage = nextPage;
		} catch {
			// swallow — scrolling again retries
		} finally {
			loadingMore = false;
		}
	}

	// Sentinel action: trigger loadMore as the bottom comes into view.
	function infiniteScroll(node: HTMLElement) {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) loadMore();
			},
			{ rootMargin: '600px' }
		);
		observer.observe(node);
		return { destroy: () => observer.disconnect() };
	}

	function isSaved(jobId: number): boolean {
		return savedJobIds[jobId] === true;
	}

	function isRejected(jobId: number): boolean {
		return rejectedJobIds[jobId] === true;
	}

	function toggleSaved(jobId: number, save: boolean) {
		if (save) {
			savedJobIds[jobId] = true;
			// Also unreject if it was rejected
			delete rejectedJobIds[jobId];
		} else {
			delete savedJobIds[jobId];
		}
	}

	function toggleRejected(jobId: number, rejected: boolean) {
		if (rejected) {
			rejectedJobIds[jobId] = true;
			// Also unsave if it was saved
			delete savedJobIds[jobId];
		} else {
			delete rejectedJobIds[jobId];
		}
	}

	function getMatch(jobId: number) {
		const m = matchesByJobId[jobId];
		if (!m || m.score === 0) return null;
		return {
			id: m.id,
			score: m.score,
			skill_match_percentage: m.skill_match_percentage,
			matched_skills: m.matched_skills as string[] | null,
			match_summary: m.match_summary as string | null
		};
	}

	function isMatched(jobId: number): boolean {
		const m = matchesByJobId[jobId];
		return !!m?.recommendation;
	}

	let profileSkillLevels = $derived(data.profileSkillLevels);

	function getSkillMatchStrength(jobId: number, skill: string): 'strong' | 'weak' | null {
		const match = getMatch(jobId);
		if (!match?.matched_skills) return null;
		if (!match.matched_skills.includes(skill)) return null;
		const level = profileSkillLevels[skill.toLowerCase()];
		if (level === 'weak') return 'weak';
		return 'strong';
	}

	// Local state for form inputs — synced from server data on navigation
	let selectedStatuses = $state<Set<string>>(new Set());
	let searchInput = $state('');
	let selectedPlatforms = $state<Set<string>>(new Set());
	let selectedWorkLocations = $state<Set<string>>(new Set());
	let selectedJobTypes = $state<Set<string>>(new Set());
	let selectedImportedBy = $state<Set<string>>(new Set());
	let minScoreFilter = $state('');
	let datePostedFilter = $state('');
	let sortFilter = $state('');
	let expandedId = $state<number | null>(null);
	let searchInputEl: HTMLInputElement;
	let openDropdown = $state<string | null>(null);

	// Re-sync local state when server filters change (e.g. sidebar navigation)
	$effect(() => {
		selectedStatuses = new Set(filters.status ? filters.status.split(',') : []);
		searchInput = filters.search;
		selectedPlatforms = new Set(filters.platform ? filters.platform.split(',') : []);
		selectedWorkLocations = new Set(filters.workLocation ? filters.workLocation.split(',') : []);
		selectedJobTypes = new Set(filters.jobType ? filters.jobType.split(',') : []);
		selectedImportedBy = new Set(filters.importedBy ? filters.importedBy.split(',') : []);
		minScoreFilter = filters.minScore;
		datePostedFilter = filters.datePosted;
		sortFilter = filters.sort;
		expandedId = null;
	});

	let pageTitle = $derived(
		selectedStatuses.has('saved')
			? 'Saved Jobs'
			: sortFilter === 'top'
				? 'Top Matches'
				: minScoreFilter === 'unmatched'
					? 'Not Yet Scored'
					: minScoreFilter === '0'
						? 'No Match'
						: minScoreFilter
							? 'Job Matches'
							: 'All Jobs'
	);

	let pageIcon = $derived(
		selectedStatuses.has('saved')
			? faBookmark
			: sortFilter === 'top' || (minScoreFilter && minScoreFilter !== '0')
				? faListCheck
				: faBriefcase
	);

	let platformString = $derived([...selectedPlatforms].join(','));
	let workLocationString = $derived([...selectedWorkLocations].join(','));
	let jobTypeString = $derived([...selectedJobTypes].join(','));
	let statusString = $derived([...selectedStatuses].join(','));
	let importedByString = $derived([...selectedImportedBy].join(','));

	function buildUrl(overrides: Record<string, string | undefined> = {}) {
		const params = new URLSearchParams();
		const st = overrides.status ?? statusString;
		const q = overrides.search ?? searchInput;
		const p = overrides.platform ?? platformString;
		const wl = overrides.workLocation ?? workLocationString;
		const jt = overrides.jobType ?? jobTypeString;
		const ms = overrides.minScore ?? minScoreFilter;
		const dp = overrides.datePosted ?? datePostedFilter;
		const ib = overrides.importedBy ?? importedByString;
		const srt = overrides.sort ?? sortFilter;
		const pg = overrides.page ?? '1';

		if (st) params.set('status', st);
		if (q) params.set('q', q);
		if (p) params.set('platform', p);
		if (wl) params.set('workLocation', wl);
		if (jt) params.set('jobType', jt);
		if (ms) params.set('minScore', ms);
		if (dp) params.set('datePosted', dp);
		if (ib) params.set('importedBy', ib);
		if (srt) params.set('sort', srt);
		if (pg !== '1') params.set('page', pg);

		return `?${params.toString()}`;
	}

	function toggleStatus(value: string) {
		selectedStatuses = toggleSetValue(selectedStatuses, value);
		goto(buildUrl({ status: [...selectedStatuses].join(','), page: '1' }));
	}

	function applySearch() {
		goto(buildUrl({ page: '1' }));
	}

	function applyFilter(overrides: Record<string, string | undefined> = {}) {
		goto(buildUrl({ ...overrides, page: '1' }));
	}

	function toggleSetValue(set: Set<string>, value: string): Set<string> {
		const next = new Set(set);
		if (next.has(value)) {
			next.delete(value);
		} else {
			next.add(value);
		}
		return next;
	}

	function togglePlatform(platformId: string) {
		selectedPlatforms = toggleSetValue(selectedPlatforms, platformId);
		goto(buildUrl({ platform: [...selectedPlatforms].join(','), page: '1' }));
	}

	function toggleWorkLocation(value: string) {
		selectedWorkLocations = toggleSetValue(selectedWorkLocations, value);
		goto(
			buildUrl({
				workLocation: [...selectedWorkLocations].join(','),
				page: '1'
			})
		);
	}

	function toggleJobType(value: string) {
		selectedJobTypes = toggleSetValue(selectedJobTypes, value);
		goto(buildUrl({ jobType: [...selectedJobTypes].join(','), page: '1' }));
	}

	function toggleImportedBy(value: string) {
		selectedImportedBy = toggleSetValue(selectedImportedBy, value);
		goto(buildUrl({ importedBy: [...selectedImportedBy].join(','), page: '1' }));
	}

	function setMinScore(value: string) {
		minScoreFilter = value;
		// Picking an explicit threshold switches off the top-matches ranking.
		applyFilter({ minScore: value, sort: '' });
	}

	function setTopMatches() {
		minScoreFilter = '';
		sortFilter = 'top';
		applyFilter({ sort: 'top', minScore: '' });
	}

	function setDatePosted(value: string) {
		datePostedFilter = value;
		applyFilter({ datePosted: value });
	}

	function toggleDropdown(name: string) {
		openDropdown = openDropdown === name ? null : name;
	}

	function handleWindowClick(e: MouseEvent) {
		if (!openDropdown) return;
		const target = e.target as HTMLElement;
		if (target.closest('[data-dropdown]')) return;
		openDropdown = null;
	}

	function clearFilters() {
		selectedStatuses = new Set();
		searchInput = '';
		selectedPlatforms = new Set();
		selectedWorkLocations = new Set();
		selectedJobTypes = new Set();
		selectedImportedBy = new Set();
		minScoreFilter = '';
		datePostedFilter = '';
		sortFilter = '';
		goto(
			buildUrl({
				status: '',
				search: '',
				platform: '',
				workLocation: '',
				jobType: '',
				minScore: '',
				datePosted: '',
				importedBy: '',
				sort: '',
				page: '1'
			})
		);
	}

	function goToPage(page: number) {
		goto(buildUrl({ page: page.toString() }));
	}

	async function toggleExpand(id: number) {
		// Capture clicked card's viewport offset before DOM changes
		const cardEl = document.querySelector(`[data-job-id="${id}"]`);
		const viewportOffset = cardEl?.getBoundingClientRect().top ?? null;

		expandedId = expandedId === id ? null : id;

		// After DOM updates, restore the card to the same viewport position
		if (viewportOffset !== null && expandedId !== null) {
			await tick();
			const updatedRect = cardEl?.getBoundingClientRect();
			if (updatedRect) {
				window.scrollBy(0, updatedRect.top - viewportOffset);
			}
		}
	}

	function truncate(text: string | null, maxLength: number): string {
		if (!text) return '';
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
	}

	// Check if any filters are active
	let hasActiveFilters = $derived(
		filters.status ||
			filters.search ||
			filters.platform ||
			filters.workLocation ||
			filters.jobType ||
			filters.minScore ||
			filters.datePosted ||
			filters.importedBy ||
			filters.sort
	);

	// Empty state messages
	let emptyTitle = $derived(
		selectedStatuses.has('saved')
			? 'No saved jobs yet'
			: minScoreFilter
				? 'No job matches yet'
				: 'No jobs found'
	);

	let emptyDescription = $derived(
		hasActiveFilters
			? 'Try adjusting your filters or search terms.'
			: 'No jobs have been imported yet. Set up job searches to start importing jobs.'
	);
</script>

<svelte:head>
	<title>All Jobs - Smart Job Seeker</title>
</svelte:head>

<svelte:window onclick={handleWindowClick} />

<div class="space-y-6">
	<SectionHeader title={pageTitle} icon={pageIcon} />

	{#if form?.error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
		</div>
	{/if}

	{#if clearMatchResult}
		<div
			class="flex items-center justify-between rounded-lg border border-green-400 bg-green-50 p-4 dark:border-green-600 dark:bg-green-900/20"
		>
			<p class="text-sm text-green-700 dark:text-green-400">
				Cleared score data for {clearMatchResult.count} job{clearMatchResult.count === 1
					? ''
					: 's'}. They will be re-scored in the next matcher cycle.
			</p>
			<button
				type="button"
				onclick={() => (clearMatchResult = null)}
				class="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
			>
				<FontAwesomeIcon icon={faTimes} class="h-4 w-4" />
			</button>
		</div>
	{/if}

	<!-- Filters -->
	<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-3 sm:p-4">
		<div class="flex flex-col gap-2">
			<div class="flex items-start gap-2">
				<div class="flex grow flex-wrap items-center gap-2">
					<!-- Min Score -->
					<div class="relative" data-dropdown="minScore">
						<button
							type="button"
							onclick={() => toggleDropdown('minScore')}
							class="
                flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors {sortFilter ===
								'top' || minScoreFilter
								? 'border-[var(--dash-primary)]/30 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
								: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}
              "
						>
							<FontAwesomeIcon icon={faGauge} class="h-3 w-3 opacity-60" />
							{sortFilter === 'top'
								? 'Top matches'
								: minScoreFilter
									? {
											'90': 'Score 90+',
											'80': 'Score 80+',
											'70': 'Score 70+',
											'60': 'Score 60+',
											'50': 'Score 50+',
											'1-49': 'Score < 50',
											'1': 'Score > 0',
											'0': 'No match',
											unmatched: 'Not scored'
										}[minScoreFilter] || 'Score'
									: 'Score'}
							{#if sortFilter !== 'top' && !minScoreFilter}
								<FontAwesomeIcon icon={faChevronDown} class="h-2.5 w-2.5 opacity-50" />
							{/if}
						</button>
						{#if openDropdown === 'minScore'}
							<div
								class="absolute top-full left-0 z-20 mt-1 min-w-[160px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
							>
								<!-- Top matches: curated freshness-decayed ranking -->
								<button
									type="button"
									onclick={() => {
										setTopMatches();
										openDropdown = null;
									}}
									class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--dash-bg)]"
								>
									<span
										class="
                      flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border {sortFilter ===
										'top'
											? 'border-[var(--dash-primary)]'
											: 'border-[var(--dash-border)]'}
                    "
									>
										{#if sortFilter === 'top'}
											<span class="h-2 w-2 rounded-full bg-[var(--dash-primary)]"></span>
										{/if}
									</span>
									<span class="font-medium text-[var(--dash-text)]">Top matches</span>
								</button>
								<div class="my-1 border-t border-[var(--dash-border)]"></div>

								{#each [{ value: '', label: 'All jobs' }, { value: '90', label: 'Score 90+' }, { value: '80', label: 'Score 80+' }, { value: '70', label: 'Score 70+' }, { value: '60', label: 'Score 60+' }, { value: '50', label: 'Score 50+' }, { value: '1-49', label: 'Score < 50' }, { value: '1', label: 'Score > 0' }, { value: '0', label: 'No match' }, { value: 'unmatched', label: 'Not yet scored' }] as opt}
									{@const selected = minScoreFilter === opt.value && sortFilter !== 'top'}
									<button
										type="button"
										onclick={() => {
											setMinScore(opt.value);
											openDropdown = null;
										}}
										class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--dash-bg)]"
									>
										<span
											class="
                        flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border {selected
												? 'border-[var(--dash-primary)]'
												: 'border-[var(--dash-border)]'}
                      "
										>
											{#if selected}
												<span class="h-2 w-2 rounded-full bg-[var(--dash-primary)]"></span>
											{/if}
										</span>
										<span class="text-[var(--dash-text)]">{opt.label}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Status multi-select -->
					<div class="relative" data-dropdown="status">
						<button
							type="button"
							onclick={() => toggleDropdown('status')}
							class="
                flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors {selectedStatuses.size >
							0
								? 'border-[var(--dash-primary)]/30 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
								: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}
              "
						>
							<FontAwesomeIcon icon={faTag} class="h-3 w-3 opacity-60" />
							Marked as
							{#if selectedStatuses.size > 0}
								<span
									class="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--dash-primary)] text-[10px] leading-none text-white"
									>{selectedStatuses.size}</span
								>
							{:else}
								<FontAwesomeIcon icon={faChevronDown} class="h-2.5 w-2.5 opacity-50" />
							{/if}
						</button>
						{#if openDropdown === 'status'}
							<div
								class="absolute top-full left-0 z-20 mt-1 min-w-[140px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
							>
								{#each [{ value: 'saved', label: 'Saved' }, { value: 'rejected', label: 'Not Interested' }] as opt}
									<button
										type="button"
										onclick={() => toggleStatus(opt.value)}
										class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--dash-bg)]"
									>
										<span
											class="
                        flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border {selectedStatuses.has(
												opt.value
											)
												? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]'
												: 'border-[var(--dash-border)]'}
                      "
										>
											{#if selectedStatuses.has(opt.value)}
												<FontAwesomeIcon icon={faCheck} class="h-2 w-2 text-white" />
											{/if}
										</span>
										<span class="text-[var(--dash-text)]">{opt.label}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Date Posted -->
					<div class="relative" data-dropdown="datePosted">
						<button
							type="button"
							onclick={() => toggleDropdown('datePosted')}
							class="
                flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors {datePostedFilter
								? 'border-[var(--dash-primary)]/30 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
								: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}
              "
						>
							<FontAwesomeIcon icon={faCalendarDays} class="h-3 w-3 opacity-60" />
							{datePostedFilter
								? {
										'1': 'Last 24h',
										'3': 'Last 3 days',
										'7': 'Last 7 days',
										'30': 'Last 30 days',
										'90': 'Last 3 months'
									}[datePostedFilter] || 'Date posted'
								: 'Date posted'}
							{#if !datePostedFilter}
								<FontAwesomeIcon icon={faChevronDown} class="h-2.5 w-2.5 opacity-50" />
							{/if}
						</button>
						{#if openDropdown === 'datePosted'}
							<div
								class="absolute top-full left-0 z-20 mt-1 min-w-[140px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
							>
								{#each [{ value: '', label: 'Any time' }, { value: '1', label: 'Last 24h' }, { value: '3', label: 'Last 3 days' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 3 months' }] as opt}
									<button
										type="button"
										onclick={() => {
											setDatePosted(opt.value);
											openDropdown = null;
										}}
										class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--dash-bg)]"
									>
										<span
											class="
                        flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border {datePostedFilter ===
											opt.value
												? 'border-[var(--dash-primary)]'
												: 'border-[var(--dash-border)]'}
                      "
										>
											{#if datePostedFilter === opt.value}
												<span class="h-2 w-2 rounded-full bg-[var(--dash-primary)]"></span>
											{/if}
										</span>
										<span class="text-[var(--dash-text)]">{opt.label}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Job Type multi-select -->
					<div class="relative" data-dropdown="jobType">
						<button
							type="button"
							onclick={() => toggleDropdown('jobType')}
							class="
                flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors {selectedJobTypes.size >
							0
								? 'border-[var(--dash-primary)]/30 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
								: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}
              "
						>
							<FontAwesomeIcon icon={faSitemap} class="h-3 w-3 opacity-60" />
							Job type
							{#if selectedJobTypes.size > 0}
								<span
									class="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--dash-primary)] text-[10px] leading-none text-white"
									>{selectedJobTypes.size}</span
								>
							{:else}
								<FontAwesomeIcon icon={faChevronDown} class="h-2.5 w-2.5 opacity-50" />
							{/if}
						</button>
						{#if openDropdown === 'jobType'}
							<div
								class="absolute top-full left-0 z-20 mt-1 min-w-[140px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
							>
								{#each [{ value: 'full_time', label: 'Full-time' }, { value: 'contract', label: 'Contract' }, { value: 'part_time', label: 'Part-time' }, { value: 'freelance', label: 'Freelance' }] as opt}
									<button
										type="button"
										onclick={() => toggleJobType(opt.value)}
										class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--dash-bg)]"
									>
										<span
											class="
                        flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border {selectedJobTypes.has(
												opt.value
											)
												? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]'
												: 'border-[var(--dash-border)]'}
                      "
										>
											{#if selectedJobTypes.has(opt.value)}
												<FontAwesomeIcon icon={faCheck} class="h-2 w-2 text-white" />
											{/if}
										</span>
										<span class="text-[var(--dash-text)]">{opt.label}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Work Location multi-select -->
					<div class="relative" data-dropdown="workLocation">
						<button
							type="button"
							onclick={() => toggleDropdown('workLocation')}
							class="
                flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors {selectedWorkLocations.size >
							0
								? 'border-[var(--dash-primary)]/30 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
								: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}
              "
						>
							<FontAwesomeIcon icon={faLocationDot} class="h-3 w-3 opacity-60" />
							Work location
							{#if selectedWorkLocations.size > 0}
								<span
									class="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--dash-primary)] text-[10px] leading-none text-white"
									>{selectedWorkLocations.size}</span
								>
							{:else}
								<FontAwesomeIcon icon={faChevronDown} class="h-2.5 w-2.5 opacity-50" />
							{/if}
						</button>
						{#if openDropdown === 'workLocation'}
							<div
								class="absolute top-full left-0 z-20 mt-1 min-w-[140px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
							>
								{#each [{ value: 'remote', label: 'Remote' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'onsite', label: 'On-site' }] as opt}
									<button
										type="button"
										onclick={() => toggleWorkLocation(opt.value)}
										class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--dash-bg)]"
									>
										<span
											class="
                        flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border {selectedWorkLocations.has(
												opt.value
											)
												? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]'
												: 'border-[var(--dash-border)]'}
                      "
										>
											{#if selectedWorkLocations.has(opt.value)}
												<FontAwesomeIcon icon={faCheck} class="h-2 w-2 text-white" />
											{/if}
										</span>
										<span class="text-[var(--dash-text)]">{opt.label}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Platform multi-select -->
					{#if platforms.length > 0}
						<div class="relative" data-dropdown="platform">
							<button
								type="button"
								onclick={() => toggleDropdown('platform')}
								class="
                  flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors {selectedPlatforms.size >
								0
									? 'border-[var(--dash-primary)]/30 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
									: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}
                "
							>
								<FontAwesomeIcon icon={faGlobe} class="h-3 w-3 opacity-60" />
								Platform
								{#if selectedPlatforms.size > 0}
									<span
										class="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--dash-primary)] text-[10px] leading-none text-white"
										>{selectedPlatforms.size}</span
									>
								{:else}
									<FontAwesomeIcon icon={faChevronDown} class="h-2.5 w-2.5 opacity-50" />
								{/if}
							</button>
							{#if openDropdown === 'platform'}
								<div
									class="absolute top-full left-0 z-20 mt-1 min-w-[140px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
								>
									{#each platforms as platform}
										<button
											type="button"
											onclick={() => togglePlatform(platform.id.toString())}
											class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--dash-bg)]"
										>
											<span
												class="
                          flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border {selectedPlatforms.has(
													platform.id.toString()
												)
													? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]'
													: 'border-[var(--dash-border)]'}
                        "
											>
												{#if selectedPlatforms.has(platform.id.toString())}
													<FontAwesomeIcon icon={faCheck} class="h-2 w-2 text-white" />
												{/if}
											</span>
											<span class="text-[var(--dash-text)]">{platform.name}</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Imported by multi-select -->
					<div class="relative" data-dropdown="importedBy">
						<button
							type="button"
							onclick={() => toggleDropdown('importedBy')}
							class="
                flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors {selectedImportedBy.size >
							0
								? 'border-[var(--dash-primary)]/30 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
								: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}
              "
						>
							<FontAwesomeIcon icon={faUser} class="h-3 w-3 opacity-60" />
							Imported by
							{#if selectedImportedBy.size > 0}
								<span
									class="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--dash-primary)] text-[10px] leading-none text-white"
									>{selectedImportedBy.size}</span
								>
							{:else}
								<FontAwesomeIcon icon={faChevronDown} class="h-2.5 w-2.5 opacity-50" />
							{/if}
						</button>
						{#if openDropdown === 'importedBy'}
							<div
								class="absolute top-full left-0 z-20 mt-1 min-w-[140px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
							>
								{#each [{ value: 'me', label: 'Me' }, { value: 'others', label: 'Others' }] as opt}
									<button
										type="button"
										onclick={() => toggleImportedBy(opt.value)}
										class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--dash-bg)]"
									>
										<span
											class="
                        flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border {selectedImportedBy.has(
												opt.value
											)
												? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]'
												: 'border-[var(--dash-border)]'}
                      "
										>
											{#if selectedImportedBy.has(opt.value)}
												<FontAwesomeIcon icon={faCheck} class="h-2 w-2 text-white" />
											{/if}
										</span>
										<span class="text-[var(--dash-text)]">{opt.label}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>

					{#if hasActiveFilters}
						<button
							type="button"
							onclick={clearFilters}
							class="flex items-center gap-1.5 rounded-md border border-[var(--dash-border)] px-2.5 py-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)]"
						>
							<FontAwesomeIcon icon={faTimes} class="h-3 w-3" />
							Clear filters
						</button>
					{/if}
				</div>

				{#if isStaff}
					<form
						bind:this={clearMatchFormEl}
						method="POST"
						action="?/clearMatchData"
						use:enhance={() => {
							isClearingMatches = true;
							clearMatchResult = null;
							return async ({ result, update }) => {
								isClearingMatches = false;
								if (result.type === 'success' && result.data) {
									clearMatchResult = { count: (result.data as any).clearedCount ?? 0 };
								}
								await update();
							};
						}}
						class="hidden"
					></form>
					<div class="relative shrink-0">
						<button
							type="button"
							onclick={() => (showAdvancedMenu = !showAdvancedMenu)}
							class="rounded p-1.5 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
							title="Advanced actions"
						>
							<FontAwesomeIcon icon={faEllipsisVertical} class="h-3 w-3" />
						</button>
						{#if showAdvancedMenu}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="fixed inset-0 z-10"
								onclick={() => (showAdvancedMenu = false)}
								onkeydown={(e) => e.key === 'Escape' && (showAdvancedMenu = false)}
							></div>
							<div
								class="absolute top-full right-0 z-20 mt-1 min-w-[180px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
							>
								<button
									type="button"
									disabled={isClearingMatches}
									onclick={() => {
										showAdvancedMenu = false;
										showClearMatchConfirm = true;
									}}
									class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-orange-600 transition-colors hover:bg-[var(--dash-bg)] disabled:opacity-50"
								>
									{#if isClearingMatches}
										<Spinner size="w-3 h-3" />
										Clearing...
									{:else}
										<FontAwesomeIcon icon={faSync} class="h-3 w-3" />
										Clear score data
									{/if}
								</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Search -->
			<div class="flex">
				<div class="relative flex-1">
					<FontAwesomeIcon
						icon={faSearch}
						class="absolute top-1/2 left-2.5 h-3 w-3 -translate-y-1/2 text-[var(--dash-text-muted)]"
					/>
					<input
						type="text"
						bind:value={searchInput}
						bind:this={searchInputEl}
						onkeydown={(e) => e.key === 'Enter' && applySearch()}
						onfocus={() => {
							openDropdown = null;
						}}
						placeholder="Search..."
						class="w-full rounded-l-md border border-[var(--dash-border)] bg-[var(--dash-bg)] py-1.5 pr-7 pl-7 text-xs text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
					{#if searchInput}
						<button
							type="button"
							onclick={() => {
								searchInput = '';
								applySearch();
								searchInputEl?.focus();
							}}
							class="absolute top-1/2 right-2 -translate-y-1/2 p-0.5 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
							aria-label="Clear search"
						>
							<FontAwesomeIcon icon={faTimes} class="h-3 w-3" />
						</button>
					{/if}
				</div>
				<button
					type="button"
					onclick={applySearch}
					class="flex items-center gap-1.5 rounded-r-md bg-[var(--dash-primary)] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
				>
					<FontAwesomeIcon icon={faSearch} class="h-3 w-3" />
					Search
				</button>
			</div>
		</div>
	</div>

	<!-- Results Count -->
	<div class="text-sm text-[var(--dash-text-secondary)]">
		{#if $navigating && jobs.length === 0}
			<span class="flex items-center gap-2">
				<Spinner size="w-4 h-4" />
				Loading...
			</span>
		{:else if totalCount === 0}
			No jobs found
		{:else if totalCount === 1}
			1 job found
		{:else}
			{totalCount.toLocaleString()} jobs found
			{#if jobs.length < totalCount}
				<span class="mx-1">•</span>
				showing {jobs.length.toLocaleString()}
			{/if}
		{/if}
	</div>

	<!-- Jobs List -->
	{#if jobs.length === 0}
		<EmptyState icon={pageIcon} title={emptyTitle} description={emptyDescription} />
	{:else}
		<div class="space-y-3">
			{#each jobs as job (job.id)}
				<JobCard
					{job}
					match={getMatch(job.id)}
					matched={isMatched(job.id)}
					{profileSkillLevels}
					isSaved={isSaved(job.id)}
					isRejected={isRejected(job.id)}
					isExpanded={expandedId === job.id}
					onToggleExpand={() => toggleExpand(job.id)}
					onToggleSaved={(saved) => toggleSaved(job.id, saved)}
					onToggleRejected={(rejected) => toggleRejected(job.id, rejected)}
				>
					{#snippet expandedContent()}
						<!-- Skills -->
						{#if job.skills_required && Array.isArray(job.skills_required) && job.skills_required.length > 0}
							<div class="mt-1">
								<p class="mb-2 text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase">
									Required Skills
								</p>
								<div class="flex flex-wrap gap-1">
									{#each job.skills_required.slice(0, 10) as skill}
										<SkillPill
											{skill}
											strength={getSkillMatchStrength(job.id, skill)}
											variant="required"
											size="sm"
										/>
									{/each}
									{#if job.skills_required.length > 10}
										<span class="px-2 py-1 text-xs text-[var(--dash-text-muted)]">
											+{job.skills_required.length - 10} more
										</span>
									{/if}
								</div>
							</div>
						{/if}

						{#if job.skills_preferred && Array.isArray(job.skills_preferred) && job.skills_preferred.length > 0}
							<div class="mt-1">
								<p class="mb-2 text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase">
									Preferred Skills
								</p>
								<div class="flex flex-wrap gap-1">
									{#each job.skills_preferred.slice(0, 10) as skill}
										<SkillPill
											{skill}
											strength={getSkillMatchStrength(job.id, skill)}
											variant="preferred"
											size="sm"
										/>
									{/each}
									{#if job.skills_preferred.length > 10}
										<span class="px-2 py-1 text-xs text-[var(--dash-text-muted)]">
											+{job.skills_preferred.length - 10} more
										</span>
									{/if}
								</div>
							</div>
						{/if}

						<!-- Description Preview -->
						{#if job.job_description}
							<div class="mt-1">
								<p class="mb-1 text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase">
									Description
								</p>
								<p class="text-sm whitespace-pre-wrap text-[var(--dash-text)]">
									{truncate(job.job_description, 500)}
								</p>
							</div>
						{/if}
					{/snippet}
				</JobCard>
			{/each}
		</div>
	{/if}

	<!-- Infinite scroll -->
	{#if hasMore}
		<div use:infiniteScroll class="h-1" aria-hidden="true"></div>
	{/if}
	{#if loadingMore || $navigating}
		<div class="flex items-center justify-center py-4">
			<Spinner size="w-5 h-5" />
		</div>
	{/if}
</div>

<ConfirmModal
	isOpen={showClearMatchConfirm}
	title="Clear Score Data"
	message="This will delete all score data for jobs matching your current filters. They will be re-scored in the next matcher cycle."
	confirmLabel="Clear Score Data"
	onCancel={() => (showClearMatchConfirm = false)}
	onConfirm={() => {
		showClearMatchConfirm = false;
		clearMatchFormEl?.requestSubmit();
	}}
/>
