<script lang="ts">
	import type { PageData } from './$types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck } from '@fortawesome/free-solid-svg-icons';
	import Card from '../../../components/Card.svelte';
	import ToggleSwitch from '../../../components/ToggleSwitch.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { autoSaveField, diffPayload, recordsEqual } from '$lib/components/auto-save.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';

	let { data }: { data: PageData } = $props();

	// Helper to normalize saved values to match our option labels (case-insensitive)
	function normalizeToOptions(saved: string[], options: string[]): string[] {
		const lowerToOption = new Map(options.map((o) => [o.toLowerCase(), o]));
		return saved
			.map((s) => lowerToOption.get(s.toLowerCase()))
			.filter((s): s is string => s !== undefined);
	}

	// Order-insensitive: these are checkbox sets, so toggling an option off and
	// back on isn't a change worth persisting.
	function setsEqual(a: string[], b: string[]): boolean {
		if (a.length !== b.length) return false;
		const sortedA = [...a].sort();
		const sortedB = [...b].sort();
		return sortedA.every((v, i) => v === sortedB[i]);
	}

	async function patchConfig(body: Record<string, unknown>) {
		const res = await fetch('/api/job-preferences', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ profile_id: data.profileId, ...body })
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.error || err.message || `Save failed (${res.status})`);
		}
	}

	// Each section auto-saves with its own undo window, mirroring the task edit
	// page. Job types and work location are required, so the $effect that feeds
	// them skips an empty selection rather than persisting one — the card shows
	// a hint instead of an indicator while that's the case.
	let jobTypes = $state<string[]>(
		normalizeToOptions(data.config.job_types || [], data.options.jobTypes)
	);
	const jobTypesField = autoSaveField<string[]>({
		initial: [...jobTypes],
		save: (v) => patchConfig({ job_types: v }),
		onSaved: (v) => (jobTypes = [...v]),
		equal: setsEqual
	});
	$effect(() => {
		if (jobTypes.length === 0) return;
		jobTypesField.set([...jobTypes]);
	});

	let workLocation = $state<string[]>(
		normalizeToOptions(data.config.work_location || [], data.options.workLocationOptions)
	);
	const workLocationField = autoSaveField<string[]>({
		initial: [...workLocation],
		save: (v) => patchConfig({ work_location: v }),
		onSaved: (v) => (workLocation = [...v]),
		equal: setsEqual
	});
	$effect(() => {
		if (workLocation.length === 0) return;
		workLocationField.set([...workLocation]);
	});

	let experienceLevels = $state<string[]>(
		normalizeToOptions(data.config.experience_levels || [], data.options.experienceLevels)
	);
	const experienceLevelsField = autoSaveField<string[]>({
		initial: [...experienceLevels],
		save: (v) => patchConfig({ experience_levels: v }),
		onSaved: (v) => (experienceLevels = [...v]),
		equal: setsEqual
	});
	$effect(() => experienceLevelsField.set([...experienceLevels]));

	let locations = $state<string[]>(data.config.locations || []);
	const locationsField = autoSaveField<string[]>({
		initial: [...locations],
		save: (v) => patchConfig({ locations: v }),
		onSaved: (v) => (locations = [...v]),
		equal: setsEqual
	});
	$effect(() => locationsField.set([...locations]));

	// Toggle + time window travel together: turning the toggle off clears the
	// window server-side, so they have to be one PATCH.
	type CommunityConfig = { enabled: boolean; maxAgeDays: number | null };
	let matchCommunityJobs = $state<boolean>(data.config.match_community_jobs ?? false);
	let communityMaxAgeDays = $state<number | null>(data.config.community_max_age_days ?? 30);
	const communityField = autoSaveField<CommunityConfig>({
		initial: {
			enabled: data.config.match_community_jobs ?? false,
			maxAgeDays: data.config.match_community_jobs
				? (data.config.community_max_age_days ?? 30)
				: null
		},
		save: (v, prev) => {
			const changed = diffPayload(
				{
					match_community_jobs: v.enabled,
					community_max_age_days: v.maxAgeDays
				},
				{
					match_community_jobs: prev.enabled,
					community_max_age_days: prev.maxAgeDays
				}
			);
			if (Object.keys(changed).length === 0) return Promise.resolve();
			return patchConfig(changed);
		},
		onSaved: (v) => {
			matchCommunityJobs = v.enabled;
			if (v.enabled) communityMaxAgeDays = v.maxAgeDays;
		},
		equal: recordsEqual
	});
	$effect(() =>
		communityField.set({
			enabled: matchCommunityJobs,
			maxAgeDays: matchCommunityJobs ? communityMaxAgeDays : null
		})
	);

	// String proxy for RadioGroup binding
	let communityMaxAgeDaysStr = $derived(
		communityMaxAgeDays === null ? 'all' : String(communityMaxAgeDays)
	);

	// Community job counts per time window
	let communityCounts = $state<Record<string, number> | null>(null);
	let communityCountsLoading = $state(false);

	// Community time window options
	let communityTimeOptions = $derived([
		{
			value: '7',
			label: communityCounts ? `7 days (${communityCounts['7'] ?? 0})` : '7 days'
		},
		{
			value: '30',
			label: communityCounts ? `30 days (${communityCounts['30'] ?? 0})` : '30 days'
		},
		{
			value: '90',
			label: communityCounts ? `90 days (${communityCounts['90'] ?? 0})` : '90 days'
		},
		{
			value: 'all',
			label: communityCounts ? `All time (${communityCounts['all'] ?? 0})` : 'All time'
		}
	]);

	async function fetchCommunityCounts() {
		communityCountsLoading = true;
		try {
			const res = await fetch(`/api/matcher/community-counts?profileId=${data.profileId}`);
			if (res.ok) {
				communityCounts = await res.json();
			}
		} finally {
			communityCountsLoading = false;
		}
	}

	// Fetch counts when community toggle is turned on
	$effect(() => {
		if (matchCommunityJobs && !communityCounts && !communityCountsLoading) {
			fetchCommunityCounts();
		}
	});

	// Location input
	let locationInput = $state('');

	function toggleArrayValue(arr: string[], value: string): string[] {
		return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
	}

	function addLocation() {
		const trimmed = locationInput.trim();
		if (trimmed && !locations.includes(trimmed)) {
			locations = [...locations, trimmed];
			locationInput = '';
		}
	}

	function removeLocation(loc: string) {
		locations = locations.filter((l) => l !== loc);
	}

	function handleLocationKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addLocation();
		}
	}
</script>

<svelte:head>
	<title>Match Config - Job Import - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-4">
	<p class="text-sm text-[var(--dash-text-secondary)]">
		Configure your job scoring preferences. Jobs are filtered based on these settings before being
		scored by the AI. Jobs must have at least one overlapping skill and meet your job type and work
		location criteria to be considered for scoring.
	</p>

	<!-- Job Types -->
	<Card padding="responsive">
		<div class="mb-4 flex items-start gap-2">
			<div>
				<h3 class="font-medium text-[var(--dash-text)]">
					Job Types <span class="text-[var(--dash-error)]">*</span>
				</h3>
				<p class="mt-0.5 text-xs text-[var(--dash-text-muted)]">
					Select the types of employment you're interested in
				</p>
			</div>
		</div>
		<div class="flex flex-wrap gap-2">
			{#each data.options.jobTypes as jobType}
				<button
					type="button"
					onclick={() => (jobTypes = toggleArrayValue(jobTypes, jobType))}
					class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors {jobTypes.includes(
						jobType
					)
						? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
						: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
				>
					<span
						class="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border {jobTypes.includes(
							jobType
						)
							? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]'
							: 'border-[var(--dash-border)]'}"
					>
						{#if jobTypes.includes(jobType)}
							<FontAwesomeIcon icon={faCheck} class="h-2.5 w-2.5 text-white" />
						{/if}
					</span>
					{jobType}
				</button>
			{/each}
		</div>
		{#if jobTypes.length === 0}
			<div class="mt-3">
				<span class="text-xs text-[var(--dash-error)]">
					Pick at least one — an empty selection isn't saved.
				</span>
			</div>
		{:else if jobTypesField.status !== 'idle'}
			<div class="mt-3">
				<AutoSaveIndicator field={jobTypesField} />
			</div>
		{/if}
	</Card>

	<!-- Work Location -->
	<Card padding="responsive">
		<div class="mb-4 flex items-start gap-2">
			<div>
				<h3 class="font-medium text-[var(--dash-text)]">
					Work Location <span class="text-[var(--dash-error)]">*</span>
				</h3>
				<p class="mt-0.5 text-xs text-[var(--dash-text-muted)]">
					Select your preferred work arrangements
				</p>
			</div>
		</div>
		<div class="flex flex-wrap gap-2">
			{#each data.options.workLocationOptions as option}
				<button
					type="button"
					onclick={() => (workLocation = toggleArrayValue(workLocation, option))}
					class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors {workLocation.includes(
						option
					)
						? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
						: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
				>
					<span
						class="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border {workLocation.includes(
							option
						)
							? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]'
							: 'border-[var(--dash-border)]'}"
					>
						{#if workLocation.includes(option)}
							<FontAwesomeIcon icon={faCheck} class="h-2.5 w-2.5 text-white" />
						{/if}
					</span>
					{option}
				</button>
			{/each}
		</div>
		{#if workLocation.length === 0}
			<div class="mt-3">
				<span class="text-xs text-[var(--dash-error)]">
					Pick at least one — an empty selection isn't saved.
				</span>
			</div>
		{:else if workLocationField.status !== 'idle'}
			<div class="mt-3">
				<AutoSaveIndicator field={workLocationField} />
			</div>
		{/if}
	</Card>

	<!-- Preferred Locations (only show when hybrid or on-site is selected) -->
	{#if workLocation.length > 1 || (workLocation.length === 1 && workLocation[0] !== 'Remote')}
		<Card padding="responsive">
			<div class="mb-4 flex items-start gap-2">
				<div>
					<h3 class="font-medium text-[var(--dash-text)]">Preferred Locations</h3>
					<p class="mt-0.5 text-xs text-[var(--dash-text-muted)]">
						Location is compared as text, not geolocation. Only relevant for hybrid and on-site
						jobs. Geo-based location filtering is planned for a future update.
					</p>
				</div>
			</div>

			<!-- Location tags -->
			{#if locations.length > 0}
				<div class="mb-3 flex flex-wrap gap-2">
					{#each locations as loc}
						<span
							class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary-light)] px-3 py-1.5 text-sm text-[var(--dash-primary)]"
						>
							{loc}
							<button
								type="button"
								onclick={() => removeLocation(loc)}
								class="transition-colors hover:text-[var(--dash-error)]"
								aria-label="Remove {loc}"
							>
								&times;
							</button>
						</span>
					{/each}
				</div>
			{/if}

			<!-- Location input -->
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={locationInput}
					onkeydown={handleLocationKeydown}
					placeholder="Add a city or region..."
					class="flex-1 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				/>
				<button
					type="button"
					onclick={addLocation}
					class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-border)]"
				>
					Add
				</button>
			</div>

			{#if locationsField.status !== 'idle'}
				<div class="mt-3">
					<AutoSaveIndicator field={locationsField} />
				</div>
			{/if}
		</Card>
	{/if}

	<!-- Experience Levels -->
	<Card padding="responsive">
		<div class="mb-4 flex items-start gap-2">
			<div>
				<h3 class="font-medium text-[var(--dash-text)]">Experience Levels</h3>
				<p class="mt-0.5 text-xs text-[var(--dash-text-muted)]">
					Optional — leave empty to include all experience levels
				</p>
			</div>
		</div>
		<div class="flex flex-wrap gap-2">
			{#each data.options.experienceLevels as level}
				<button
					type="button"
					onclick={() => (experienceLevels = toggleArrayValue(experienceLevels, level))}
					class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors {experienceLevels.includes(
						level
					)
						? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
						: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
				>
					<span
						class="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border {experienceLevels.includes(
							level
						)
							? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]'
							: 'border-[var(--dash-border)]'}"
					>
						{#if experienceLevels.includes(level)}
							<FontAwesomeIcon icon={faCheck} class="h-2.5 w-2.5 text-white" />
						{/if}
					</span>
					{level}
				</button>
			{/each}
		</div>
		{#if experienceLevelsField.status !== 'idle'}
			<div class="mt-3">
				<AutoSaveIndicator field={experienceLevelsField} />
			</div>
		{/if}
	</Card>

	<!-- Community Jobs -->
	<Card padding="responsive">
		<ToggleSwitch
			bind:checked={matchCommunityJobs}
			label="Also score jobs imported by other users"
			description="When enabled, community jobs will also be filtered and scored against your profile. Only jobs that pass your filters are scored by the AI — scoring uses less usage per job than importing. Your own jobs are always scored first."
		/>
		{#if matchCommunityJobs}
			<div class="mt-4 border-t border-[var(--dash-border)] pt-4">
				<p class="mb-2 text-xs text-[var(--dash-text-muted)]">
					Include community jobs from the last:
				</p>
				<div class="flex flex-wrap gap-2">
					{#each communityTimeOptions as opt}
						<button
							type="button"
							onclick={() =>
								(communityMaxAgeDays = opt.value === 'all' ? null : parseInt(opt.value))}
							class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors {communityMaxAgeDaysStr ===
							opt.value
								? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
								: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
						>
							<span
								class="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border {communityMaxAgeDaysStr ===
								opt.value
									? 'border-[var(--dash-primary)]'
									: 'border-[var(--dash-border)]'}"
							>
								{#if communityMaxAgeDaysStr === opt.value}
									<span class="h-2 w-2 rounded-full bg-[var(--dash-primary)]"></span>
								{/if}
							</span>
							{opt.label}
						</button>
					{/each}
				</div>
				{#if communityCountsLoading}
					<p class="mt-2 flex items-center gap-1 text-xs text-[var(--dash-text-muted)]">
						<Spinner size="w-3 h-3" /> Loading job counts…
					</p>
				{:else if communityCounts}
					{@const selectedKey = communityMaxAgeDays === null ? 'all' : String(communityMaxAgeDays)}
					{@const count = communityCounts[selectedKey] ?? 0}
					<p class="mt-2 text-xs text-[var(--dash-text-muted)]">
						{count} unscored community {count === 1 ? 'job' : 'jobs'} to process
						{#if count > 0}
							(≈{count}–{count * 2} usage)
						{/if}
					</p>
				{/if}
			</div>
		{/if}
		{#if communityField.status !== 'idle'}
			<div class="mt-3">
				<AutoSaveIndicator field={communityField} />
			</div>
		{/if}
	</Card>
</div>
