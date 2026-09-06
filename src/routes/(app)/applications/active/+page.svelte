<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowDownWideShort,
		faBuilding,
		faCalendar,
		faCalendarCheck,
		faChevronDown,
		faClock,
		faClockRotateLeft,
		faFilter,
		faGlobe,
		faHandPointRight,
		faLayerGroup,
		faMapMarkerAlt,
		faMoneyBillWave,
		faMugHot,
		faPaperPlane,
		faPlay,
		faPlus,
		faSearch,
		faTimes
	} from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import EmptyState from '../../profile/components/EmptyState.svelte';
	import CategoryPill from '$lib/components/CategoryPill.svelte';
	import { formatSalaryRange, timeAgo } from '$lib/format';
	import {
		statusOptions,
		getStatusLabel,
		getStatusColor,
		getStatusDotColor
	} from '$lib/application-status';
	import { sortOptions } from '$lib/application-ranking';
	import { describeSnooze, isSnoozed, snoozePresets, snoozeUntil } from '$lib/application-snooze';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let applications = $derived(data.applications);
	let openDropdown = $state<string | null>(null);

	// Filter state synced from server data
	let groupFilter = $state(data.currentGroup);
	let phaseFilter = $state(data.currentPhase);
	let platformFilter = $state(data.currentPlatform);
	let sortOrder = $state(data.currentSort);
	let searchInput = $state(data.currentSearch);
	let searchInputEl: HTMLInputElement;

	$effect(() => {
		groupFilter = data.currentGroup;
		phaseFilter = data.currentPhase;
		platformFilter = data.currentPlatform;
		sortOrder = data.currentSort;
		searchInput = data.currentSearch;
	});

	// "Snoozed" is only offered once something is in it — an empty group is a
	// filter that can only ever disappoint.
	let groupOptions = $derived([
		{ value: 'all', label: 'All' },
		{ value: 'active', label: 'Active' },
		{ value: 'action', label: 'Needs Action' },
		...(data.snoozedCount > 0
			? [{ value: 'snoozed', label: `Snoozed (${data.snoozedCount})` }]
			: []),
		{ value: 'finished', label: 'Finished' }
	]);

	// Sort counts, so "Clear" can put a list that reads oddly back to the default
	// order without the user having to work out which control did it.
	let hasActiveFilters = $derived(
		groupFilter !== 'all' ||
			phaseFilter !== '' ||
			platformFilter !== '' ||
			searchInput !== '' ||
			sortOrder !== 'smart'
	);

	function buildUrl(overrides: Record<string, string> = {}) {
		const params = new URLSearchParams();
		const g = overrides.group ?? groupFilter;
		const p = overrides.phase ?? phaseFilter;
		const pl = overrides.platform ?? platformFilter;
		const q = overrides.search ?? searchInput;
		const s = overrides.sort ?? sortOrder;
		if (g && g !== 'all') params.set('group', g);
		if (p) params.set('phase', p);
		if (pl) params.set('platform', pl);
		if (q) params.set('q', q);
		// The default is left out of the URL so a shared link carries the filters
		// that were chosen and nothing that was merely not changed.
		if (s && s !== 'smart') params.set('sort', s);
		return `?${params.toString()}`;
	}

	// The only navigation in the file. Every control used to call `goto` itself,
	// which meant adding one more control meant adding one more unresolved
	// navigation to the lint backlog; routing them through here resolves the
	// route id once and the count goes down instead of up.
	function navigate(overrides: Record<string, string> = {}) {
		// The route id IS resolved; the rule only recognises a bare `resolve()` as
		// the whole argument, and every navigation here carries a query string.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`${resolve('/(app)/applications/active')}${buildUrl(overrides)}`);
	}

	function setGroup(value: string) {
		groupFilter = value;
		// Clear phase filter when changing group (phase is a sub-filter)
		phaseFilter = '';
		navigate({ group: value, phase: '' });
	}

	function setPhase(value: string) {
		phaseFilter = value;
		navigate({ phase: value });
	}

	function setPlatform(value: string) {
		platformFilter = value;
		navigate({ platform: value });
	}

	function setSort(value: string) {
		sortOrder = value as typeof sortOrder;
		navigate({ sort: value });
	}

	function applySearch() {
		navigate();
	}

	function clearFilters() {
		groupFilter = 'all';
		phaseFilter = '';
		platformFilter = '';
		sortOrder = 'smart';
		searchInput = '';
		// Reads the state just reset above, so this is the bare route.
		navigate();
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

	function formatDate(date: Date | string | null): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatSalary(
		min: number | null,
		max: number | null,
		currency: string | null,
		period: string | null
	): string {
		const result = formatSalaryRange(min, max, currency, period);
		return result === 'Not specified' ? '' : result;
	}

	function asStringArray(value: unknown): string[] {
		return Array.isArray(value) ? value : [];
	}
</script>

<svelte:window onclick={handleWindowClick} />

<svelte:head>
	<title>Applications - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader title="All Applications" icon={faPaperPlane} />

	{#if form?.error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
		</div>
	{/if}

	<!-- Filters -->
	<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-3 sm:p-4">
		<div class="inline-flex flex-col gap-2">
			<div class="flex flex-wrap items-center gap-2">
				<!-- Group -->
				<div class="relative" data-dropdown="group">
					<button
						type="button"
						onclick={() => toggleDropdown('group')}
						class="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors {groupFilter !==
						'all'
							? 'border-[var(--dash-primary)]/30 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
							: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}"
					>
						<FontAwesomeIcon icon={faFilter} class="h-3 w-3 opacity-60" />
						{groupOptions.find((o) => o.value === groupFilter)?.label ?? 'All'}
						{#if groupFilter === 'all'}
							<FontAwesomeIcon icon={faChevronDown} class="h-2.5 w-2.5 opacity-50" />
						{/if}
					</button>
					{#if openDropdown === 'group'}
						<div
							class="absolute top-full left-0 z-20 mt-1 min-w-[160px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
						>
							{#each groupOptions as opt}
								<button
									type="button"
									onclick={() => {
										setGroup(opt.value);
										openDropdown = null;
									}}
									class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--dash-bg)]"
								>
									<span
										class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border {groupFilter ===
										opt.value
											? 'border-[var(--dash-primary)]'
											: 'border-[var(--dash-border)]'}"
									>
										{#if groupFilter === opt.value}
											<span class="h-2 w-2 rounded-full bg-[var(--dash-primary)]"></span>
										{/if}
									</span>
									<span class="text-[var(--dash-text)]">{opt.label}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Phase -->
				<div class="relative" data-dropdown="phase">
					<button
						type="button"
						onclick={() => toggleDropdown('phase')}
						class="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors {phaseFilter
							? 'border-[var(--dash-primary)]/30 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
							: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}"
					>
						<FontAwesomeIcon icon={faLayerGroup} class="h-3 w-3 opacity-60" />
						{phaseFilter ? getStatusLabel(phaseFilter) : 'Phase'}
						{#if !phaseFilter}
							<FontAwesomeIcon icon={faChevronDown} class="h-2.5 w-2.5 opacity-50" />
						{/if}
					</button>
					{#if openDropdown === 'phase'}
						<div
							class="absolute top-full left-0 z-20 mt-1 min-w-[160px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
						>
							<button
								type="button"
								onclick={() => {
									setPhase('');
									openDropdown = null;
								}}
								class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--dash-bg)]"
							>
								<span
									class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border {!phaseFilter
										? 'border-[var(--dash-primary)]'
										: 'border-[var(--dash-border)]'}"
								>
									{#if !phaseFilter}
										<span class="h-2 w-2 rounded-full bg-[var(--dash-primary)]"></span>
									{/if}
								</span>
								<span class="text-[var(--dash-text)]">Any phase</span>
							</button>
							{#each statusOptions as opt}
								<button
									type="button"
									onclick={() => {
										setPhase(opt.value);
										openDropdown = null;
									}}
									class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--dash-bg)]"
								>
									<span
										class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border {phaseFilter ===
										opt.value
											? 'border-[var(--dash-primary)]'
											: 'border-[var(--dash-border)]'}"
									>
										{#if phaseFilter === opt.value}
											<span class="h-2 w-2 rounded-full bg-[var(--dash-primary)]"></span>
										{/if}
									</span>
									<span class="{getStatusColor(opt.value)} rounded-full px-1.5 py-0.5 text-xs"
										>{opt.label}</span
									>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Platform -->
				{#if data.platforms.length > 0}
					<div class="relative" data-dropdown="platform">
						<button
							type="button"
							onclick={() => toggleDropdown('platform')}
							class="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors {platformFilter
								? 'border-[var(--dash-primary)]/30 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
								: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}"
						>
							<FontAwesomeIcon icon={faGlobe} class="h-3 w-3 opacity-60" />
							{platformFilter
								? (data.platforms.find((p) => String(p.id) === platformFilter)?.name ?? 'Platform')
								: 'Platform'}
							{#if !platformFilter}
								<FontAwesomeIcon icon={faChevronDown} class="h-2.5 w-2.5 opacity-50" />
							{/if}
						</button>
						{#if openDropdown === 'platform'}
							<div
								class="absolute top-full left-0 z-20 mt-1 min-w-[160px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
							>
								<button
									type="button"
									onclick={() => {
										setPlatform('');
										openDropdown = null;
									}}
									class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--dash-bg)]"
								>
									<span
										class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border {!platformFilter
											? 'border-[var(--dash-primary)]'
											: 'border-[var(--dash-border)]'}"
									>
										{#if !platformFilter}
											<span class="h-2 w-2 rounded-full bg-[var(--dash-primary)]"></span>
										{/if}
									</span>
									<span class="text-[var(--dash-text)]">Any platform</span>
								</button>
								{#each data.platforms as plat}
									<button
										type="button"
										onclick={() => {
											setPlatform(String(plat.id));
											openDropdown = null;
										}}
										class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--dash-bg)]"
									>
										<span
											class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border {platformFilter ===
											String(plat.id)
												? 'border-[var(--dash-primary)]'
												: 'border-[var(--dash-border)]'}"
										>
											{#if platformFilter === String(plat.id)}
												<span class="h-2 w-2 rounded-full bg-[var(--dash-primary)]"></span>
											{/if}
										</span>
										<span class="text-[var(--dash-text)]">{plat.name}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Sort -->
				<div class="relative" data-dropdown="sort">
					<button
						type="button"
						onclick={() => toggleDropdown('sort')}
						class="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors {sortOrder !==
						'smart'
							? 'border-[var(--dash-primary)]/30 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
							: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}"
					>
						<FontAwesomeIcon icon={faArrowDownWideShort} class="h-3 w-3 opacity-60" />
						{sortOptions.find((o) => o.value === sortOrder)?.label ?? 'Smart'}
						{#if sortOrder === 'smart'}
							<FontAwesomeIcon icon={faChevronDown} class="h-2.5 w-2.5 opacity-50" />
						{/if}
					</button>
					{#if openDropdown === 'sort'}
						<div
							class="absolute top-full left-0 z-20 mt-1 min-w-[200px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
						>
							{#each sortOptions as opt (opt.value)}
								<button
									type="button"
									onclick={() => {
										setSort(opt.value);
										openDropdown = null;
									}}
									class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--dash-bg)]"
								>
									<span
										class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border {sortOrder ===
										opt.value
											? 'border-[var(--dash-primary)]'
											: 'border-[var(--dash-border)]'}"
									>
										{#if sortOrder === opt.value}
											<span class="h-2 w-2 rounded-full bg-[var(--dash-primary)]"></span>
										{/if}
									</span>
									<span class="text-[var(--dash-text)]">{opt.label}</span>
								</button>
							{/each}
							<p
								class="mt-1 border-t border-[var(--dash-border)] px-3 pt-1.5 pb-1 text-[10px] leading-snug text-[var(--dash-text-muted)]"
							>
								Smart puts what needs you first, then how far along it is, then how recently
								anything happened.
							</p>
						</div>
					{/if}
				</div>

				{#if hasActiveFilters}
					<button
						type="button"
						onclick={clearFilters}
						class="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
					>
						<FontAwesomeIcon icon={faTimes} class="h-3 w-3" />
						Clear
					</button>
				{/if}

				<a
					href="/applications/new"
					class="flex items-center gap-2 rounded-md bg-[var(--dash-primary)] px-2.5 py-1.5 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
				>
					<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
					New
				</a>
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
						placeholder="Search job title, company, notes..."
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

	<!-- Applications List -->
	{#if applications.length === 0}
		<EmptyState
			icon={faPaperPlane}
			title="No applications yet"
			description={hasActiveFilters
				? 'No applications match your current filters.'
				: 'Your job applications will appear here. Start by applying to jobs from the matches page.'}
		/>
	{:else}
		<div class="space-y-3">
			{#each applications as app (app.id)}
				{@const job = app.job}
				{@const salaryText = job
					? formatSalary(job.salary_min, job.salary_max, job.salary_currency, job.salary_period)
					: ''}
				{@const workLocations = asStringArray(job?.work_location)}
				{@const jobTypes = asStringArray(job?.job_types)}
				{@const experienceLevels = asStringArray(job?.experience_levels)}
				{@const snoozed = isSnoozed(app, data.today)}
				<!-- Relative wrapper so the snooze control can sit OUTSIDE the anchor:
				     the card is one link, and a button nested in it would be a second
				     interactive element inside the first. -->
				<div class="relative">
					<a
						href="/applications/{app.id}"
						data-app-id={app.id}
						class="block overflow-hidden rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] transition-all hover:border-[var(--dash-primary)] hover:ring-2 hover:ring-[var(--dash-primary)]/20 {snoozed
							? 'opacity-60'
							: ''}"
					>
						<div class="p-3 sm:p-4">
							<!-- Title (full width) -->
							<h3
								class="line-clamp-2 pr-9 text-sm font-medium text-[var(--dash-text)] sm:truncate sm:text-base"
							>
								{job?.title || 'Unknown Position'}
							</h3>

							{#if snoozed && app.snoozed_until}
								<p
									class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--dash-text-muted)]"
								>
									<span
										class="inline-flex items-center gap-1 rounded-full bg-[var(--dash-bg)] px-2 py-0.5 font-medium"
									>
										<FontAwesomeIcon icon={faMugHot} class="h-3 w-3" />
										Snoozed — {describeSnooze(app.snoozed_until, data.today)}
									</span>
									{#if app.snooze_reason}
										<span class="italic">{app.snooze_reason}</span>
									{/if}
								</p>
							{/if}

							<!-- Details + Status widget row -->
							<div class="mt-1 flex items-start gap-3">
								<!-- Details -->
								<div class="min-w-0 flex-1">
									<!-- Company, location, platform -->
									<div
										class="flex flex-wrap items-center gap-2 text-xs text-[var(--dash-text-secondary)] sm:gap-3 sm:text-sm"
									>
										{#if job?.company}
											<span class="flex items-center gap-1">
												<FontAwesomeIcon icon={faBuilding} class="h-3 w-3" />
												<span class="max-w-[120px] truncate sm:max-w-none">{job.company}</span>
											</span>
										{/if}
										{#if job?.office_location}
											<span class="flex items-center gap-1">
												<FontAwesomeIcon icon={faMapMarkerAlt} class="h-3 w-3" />
												<span class="max-w-[100px] truncate sm:max-w-none"
													>{job.office_location}</span
												>
											</span>
										{/if}
										{#if job?.job_platform}
											<span class="flex items-center gap-1">
												<FontAwesomeIcon
													icon={faGlobe}
													class="h-3.5 w-3.5 text-[var(--dash-text-muted)]"
												/>
												{job.job_platform.name}
											</span>
										{/if}
									</div>

									<!-- Tags: work location, job type, experience level -->
									{#if workLocations.length > 0 || jobTypes.length > 0 || experienceLevels.length > 0}
										<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
											{#each workLocations as loc}
												<CategoryPill category="work_location" value={loc} />
											{/each}
											{#each jobTypes as type}
												<CategoryPill category="job_type" value={type} />
											{/each}
											{#each experienceLevels as level}
												<CategoryPill category="experience_level" value={level} />
											{/each}
										</div>
									{/if}

									<!-- Salary and Date row -->
									<div class="mt-1.5 flex items-center justify-between sm:mt-2">
										<div class="flex flex-wrap items-center gap-2 text-xs sm:gap-4 sm:text-sm">
											{#if salaryText}
												<span class="flex items-center gap-1 text-[var(--dash-success)]">
													<FontAwesomeIcon icon={faMoneyBillWave} class="h-3 w-3" />
													<span class="max-w-[140px] truncate sm:max-w-none">{salaryText}</span>
												</span>
											{/if}
											<!-- Last activity, not the date the row was added: the list is
											     ordered by this, so showing the creation date instead would
											     make the order look arbitrary. The added date moves to the
											     tooltip rather than being dropped. -->
											{#if app.last_activity}
												<span
													class="flex items-center gap-1 text-[var(--dash-text-secondary)]"
													title="Last activity {formatDate(app.last_activity)}{app.date_created
														? ` · added ${formatDate(app.date_created)}`
														: ''}"
												>
													<FontAwesomeIcon icon={faClockRotateLeft} class="h-3 w-3" />
													{timeAgo(app.last_activity)}
													<span class="opacity-50">{formatDate(app.last_activity)}</span>
												</span>
											{/if}
										</div>
									</div>
								</div>

								<!-- Status widget (right side) -->
								<div class="flex-shrink-0 self-center">
									<div
										class="flex flex-col items-center justify-center gap-1 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2.5"
									>
										<span
											class="text-xs font-semibold tracking-wide uppercase {getStatusDotColor(
												app.status
											)} whitespace-nowrap"
										>
											{getStatusLabel(app.status)}
										</span>
										{#if app.status_step}
											<span
												class="text-xs whitespace-nowrap text-[var(--dash-text-secondary)] italic"
											>
												{app.status_step}
											</span>
										{/if}
										{#if app.status_action}
											{@const isWaiting = app.status_action.startsWith('Awaiting')}
											{@const isScheduled = app.status_action === 'Scheduled'}
											<span
												class="flex items-center gap-1 text-xs font-medium whitespace-nowrap {isWaiting
													? 'text-[var(--dash-text-muted)]'
													: isScheduled
														? 'text-[var(--dash-success)]'
														: 'text-[var(--dash-primary)]'}"
											>
												{#key app.status_action}
													<FontAwesomeIcon
														icon={isWaiting
															? faClock
															: isScheduled
																? faCalendarCheck
																: faHandPointRight}
														class="h-3 w-3"
													/>
												{/key}
												{app.status_action}
											</span>
										{/if}
									</div>
								</div>
							</div>
						</div>
					</a>

					<!-- Snooze / resume. Inside [data-dropdown] so the window click-outside
					     handler does not close the menu on the click that opened it. -->
					<div class="absolute top-2.5 right-2.5" data-dropdown="snooze-{app.id}">
						<button
							type="button"
							onclick={() => toggleDropdown(`snooze-${app.id}`)}
							title={snoozed ? 'Snoozed' : 'Snooze this application'}
							aria-label={snoozed ? 'Snoozed' : 'Snooze this application'}
							class="flex h-7 w-7 items-center justify-center rounded-md text-[var(--dash-text-muted)] transition-colors hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] {snoozed
								? 'text-[var(--dash-text)]'
								: ''}"
						>
							<FontAwesomeIcon icon={snoozed ? faPlay : faMugHot} class="h-3.5 w-3.5" />
						</button>

						{#if openDropdown === `snooze-${app.id}`}
							<div
								class="absolute top-full right-0 z-20 mt-1 min-w-[170px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
							>
								{#if snoozed}
									<form
										method="POST"
										action="?/resume"
										use:enhance={() => {
											openDropdown = null;
											return async ({ update }) => await update();
										}}
									>
										<input type="hidden" name="id" value={app.id} />
										<button
											type="submit"
											class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
										>
											<FontAwesomeIcon icon={faPlay} class="h-3 w-3 opacity-60" />
											Resume now
										</button>
									</form>
									<div class="my-1 border-t border-[var(--dash-border)]"></div>
								{/if}
								<p
									class="px-3 py-1 text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase"
								>
									{snoozed ? 'Snooze again for' : 'Snooze for'}
								</p>
								{#each snoozePresets as preset (preset.value)}
									<form
										method="POST"
										action="?/snooze"
										use:enhance={() => {
											openDropdown = null;
											return async ({ update }) => await update();
										}}
									>
										<input type="hidden" name="id" value={app.id} />
										<input
											type="hidden"
											name="until"
											value={snoozeUntil(preset.days, data.today)}
										/>
										<button
											type="submit"
											class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
										>
											<FontAwesomeIcon icon={faClock} class="h-3 w-3 opacity-60" />
											{preset.label}
										</button>
									</form>
								{/each}
								<div class="my-1 border-t border-[var(--dash-border)]"></div>
								<a
									href={resolve('/(app)/applications/[id]', { id: String(app.id) })}
									class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)]"
								>
									<FontAwesomeIcon icon={faCalendar} class="h-3 w-3 opacity-60" />
									Pick a date…
								</a>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
