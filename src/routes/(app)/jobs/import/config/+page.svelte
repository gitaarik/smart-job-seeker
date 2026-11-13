<script lang="ts">
	import type { PageData } from './$types';
	import { untrack } from 'svelte';
	import { remountOnAppliedChange } from '$lib/components/applied-change.svelte';
	import { armOn } from '$lib/actions/arm-on';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck } from '@fortawesome/free-solid-svg-icons';
	import Card from '../../../components/Card.svelte';
	import ToggleSwitch from '../../../components/ToggleSwitch.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { resolve } from '$app/paths';
	import { autoSaveField, diffPayload, recordsEqual } from '$lib/components/auto-save.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import PlacePicker from '$lib/components/PlacePicker.svelte';
	import type { PreferredPlace } from '$lib/data/places';
	import { formatCurrency } from '$lib/salary/conversion';

	let { data }: { data: PageData } = $props();

	// Every section below starts from `data` once, at mount, and owns its value
	// from then on. The assistant can change these preferences from the chat
	// panel (`edit_match_config`, made for this very page), and a proposal applied
	// there mounts the page again rather than leaving it on the old lists: the
	// saves here send a whole list and no `expected`, so a stale checkbox
	// clicked afterwards would quietly have put the old list back.
	remountOnAppliedChange();
	const loaded = untrack(() => data);

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
	const loadedJobTypes = normalizeToOptions(loaded.config.job_types || [], loaded.options.jobTypes);
	let jobTypes = $state<string[]>([...loadedJobTypes]);
	const jobTypesField = autoSaveField<string[]>({
		armOnInteraction: true,
		initial: [...loadedJobTypes],
		save: (v) => patchConfig({ job_types: v }),
		onSaved: (v) => (jobTypes = [...v]),
		equal: setsEqual
	});
	$effect(() => {
		if (jobTypes.length === 0) return;
		jobTypesField.set([...jobTypes]);
	});

	const loadedWorkLocation = normalizeToOptions(
		loaded.config.work_location || [],
		loaded.options.workLocationOptions
	);
	let workLocation = $state<string[]>([...loadedWorkLocation]);
	const workLocationField = autoSaveField<string[]>({
		armOnInteraction: true,
		initial: [...loadedWorkLocation],
		save: (v) => patchConfig({ work_location: v }),
		onSaved: (v) => (workLocation = [...v]),
		equal: setsEqual
	});
	$effect(() => {
		if (workLocation.length === 0) return;
		workLocationField.set([...workLocation]);
	});

	// Remote jobs limited to other countries: only asked when Remote is picked.
	let remoteAbroad = $state<boolean>(loaded.config.remote_abroad);
	const remoteAbroadField = autoSaveField<boolean>({
		armOnInteraction: true,
		initial: loaded.config.remote_abroad,
		save: (v) => patchConfig({ remote_abroad: v }),
		onSaved: (v) => (remoteAbroad = v)
	});
	$effect(() => remoteAbroadField.set(remoteAbroad));

	const loadedExperienceLevels = normalizeToOptions(
		loaded.config.experience_levels || [],
		loaded.options.experienceLevels
	);
	let experienceLevels = $state<string[]>([...loadedExperienceLevels]);
	const experienceLevelsField = autoSaveField<string[]>({
		armOnInteraction: true,
		initial: [...loadedExperienceLevels],
		save: (v) => patchConfig({ experience_levels: v }),
		onSaved: (v) => (experienceLevels = [...v]),
		equal: setsEqual
	});
	$effect(() => experienceLevelsField.set([...experienceLevels]));

	// Preferred Locations: the places picked, and the texts typed before the
	// picker that are not a place (yet), which can only be removed. One field,
	// one PATCH, so undo puts back both.
	type Preferred = { places: PreferredPlace[]; texts: string[] };
	let places = $state<PreferredPlace[]>([...loaded.config.places]);
	let unplacedTexts = $state<string[]>([...loaded.config.locations]);
	const placesField = autoSaveField<Preferred>({
		armOnInteraction: true,
		initial: { places: [...loaded.config.places], texts: [...loaded.config.locations] },
		save: (v) => patchConfig({ places: v.places, locations: v.texts }),
		onSaved: (v) => {
			places = [...v.places];
			unplacedTexts = [...v.texts];
		},
		equal: (a, b) =>
			setsEqual(
				a.places.map((p) => String(p.id)),
				b.places.map((p) => String(p.id))
			) && setsEqual(a.texts, b.texts)
	});
	$effect(() => placesField.set({ places: [...places], texts: [...unplacedTexts] }));

	// Toggle + time window travel together: turning the toggle off clears the
	// window server-side, so they have to be one PATCH.
	type CommunityConfig = { enabled: boolean; maxAgeDays: number | null };
	let matchCommunityJobs = $state<boolean>(loaded.config.match_community_jobs ?? false);
	let communityMaxAgeDays = $state<number | null>(loaded.config.community_max_age_days ?? 30);
	const communityField = autoSaveField<CommunityConfig>({
		armOnInteraction: true,
		initial: {
			enabled: loaded.config.match_community_jobs ?? false,
			maxAgeDays: loaded.config.match_community_jobs
				? (loaded.config.community_max_age_days ?? 30)
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

	// The pay switch and its tolerance save as one PATCH, like the community pair.
	type PayConfig = { enabled: boolean; tolerancePct: number };
	let hideBelowAsk = $state<boolean>(loaded.config.hide_below_ask);
	let belowAskTolerance = $state<number>(loaded.config.below_ask_tolerance_pct);
	const payField = autoSaveField<PayConfig>({
		armOnInteraction: true,
		initial: {
			enabled: loaded.config.hide_below_ask,
			tolerancePct: loaded.config.below_ask_tolerance_pct
		},
		save: (v, prev) => {
			const changed = diffPayload(
				{ hide_below_ask: v.enabled, below_ask_tolerance_pct: v.tolerancePct },
				{ hide_below_ask: prev.enabled, below_ask_tolerance_pct: prev.tolerancePct }
			);
			if (Object.keys(changed).length === 0) return Promise.resolve();
			return patchConfig(changed);
		},
		onSaved: (v) => {
			hideBelowAsk = v.enabled;
			belowAskTolerance = v.tolerancePct;
		},
		equal: recordsEqual
	});
	$effect(() => payField.set({ enabled: hideBelowAsk, tolerancePct: belowAskTolerance }));

	// Corpus picks: the switch and the daily number save as one PATCH.
	type PicksConfig = { enabled: boolean; perDay: number };
	const PICKS_PER_DAY = [5, 10, 25, 50];
	let corpusPicks = $state<boolean>(loaded.config.corpus_picks_enabled);
	let picksPerDay = $state<number>(loaded.config.corpus_picks_per_day);
	const picksField = autoSaveField<PicksConfig>({
		armOnInteraction: true,
		initial: {
			enabled: loaded.config.corpus_picks_enabled,
			perDay: loaded.config.corpus_picks_per_day
		},
		save: (v, prev) => {
			const changed = diffPayload(
				{ corpus_picks_enabled: v.enabled, corpus_picks_per_day: v.perDay },
				{ corpus_picks_enabled: prev.enabled, corpus_picks_per_day: prev.perDay }
			);
			if (Object.keys(changed).length === 0) return Promise.resolve();
			return patchConfig(changed);
		},
		onSaved: (v) => {
			corpusPicks = v.enabled;
			picksPerDay = v.perDay;
		},
		equal: recordsEqual
	});
	$effect(() => picksField.set({ enabled: corpusPicks, perDay: picksPerDay }));

	const PER: Record<string, string> = {
		hour: 'an hour',
		day: 'a day',
		month: 'a month',
		year: 'a year'
	};
	type AskSummary = { amount: number; currency: string; per: string } | null;
	const askText = (ask: AskSummary, as: string) =>
		ask ? `${formatCurrency(ask.amount, ask.currency)} ${PER[ask.per]} ${as}` : null;
	/** "€8,700 a month as a salary, €83 an hour freelance": what "my ask" means here. */
	const asksText = $derived(
		[askText(data.asks.employed, 'as a salary'), askText(data.asks.freelance, 'freelance')]
			.filter(Boolean)
			.join(', ')
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

	function toggleArrayValue(arr: string[], value: string): string[] {
		return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
	}
</script>

<svelte:head>
	<title>Match Config - Job Import - Smart Job Seeker</title>
</svelte:head>

<div
	class="space-y-4"
	use:armOn={() => {
		jobTypesField.arm();
		workLocationField.arm();
		remoteAbroadField.arm();
		experienceLevelsField.arm();
		placesField.arm();
		communityField.arm();
		payField.arm();
		picksField.arm();
	}}
>
	<p class="text-sm text-[var(--dash-text-secondary)]">
		Configure your job scoring preferences. Jobs are filtered based on these settings before being
		scored by the AI. Jobs must have at least one overlapping skill and meet your job type and work
		location criteria to be considered for scoring.
	</p>

	<p class="text-sm text-[var(--dash-text-secondary)]">
		These are standing preferences, separate from the filters on any one Import Task.
		<a
			href={resolve('/guide/[slug]', { slug: 'matching' })}
			class="text-[var(--dash-primary)] hover:underline">Read the guide</a
		>.
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
			{#each data.options.jobTypes as jobType (jobType)}
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
			{#each data.options.workLocationOptions as option (option)}
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
		{#if workLocation.includes('Remote')}
			<div class="mt-4 border-t border-[var(--dash-border)] pt-4">
				<ToggleSwitch
					bind:checked={remoteAbroad}
					label="Include remote jobs limited to other countries"
					description="Many remote jobs are only open to people in one country or region, like “Remote (Canada)” or “US only”. Off, the jobs found for you leave those out. Turn it on if you work as a contractor for companies abroad."
				/>
				{#if remoteAbroadField.status !== 'idle'}
					<div class="mt-3">
						<AutoSaveIndicator field={remoteAbroadField} />
					</div>
				{/if}
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
						Where you can work hybrid or on-site. A city or a province counts as its country, a
						region as all of its countries; distance from a city is planned for a future update.
						Empty means the country on your profile. Remote jobs limited to certain countries are
						held to these too.
					</p>
				</div>
			</div>

			{#if unplacedTexts.length > 0}
				<div class="mb-3">
					<p class="mb-1.5 text-xs text-[var(--dash-text-secondary)]">
						Typed before places could be picked, and not found as a place. They are still read as
						text: pick the place below and remove these.
					</p>
					<div class="flex flex-wrap gap-2">
						{#each unplacedTexts as text (text)}
							<span
								class="flex items-center gap-2 rounded-lg border border-dashed border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)]"
							>
								{text}
								<button
									type="button"
									onclick={() => (unplacedTexts = unplacedTexts.filter((t) => t !== text))}
									class="transition-colors hover:text-[var(--dash-error)]"
									aria-label="Remove {text}"
								>
									&times;
								</button>
							</span>
						{/each}
					</div>
				</div>
			{/if}

			<PlacePicker multiple bind:places placeholder="Add a city, country or region..." />

			{#if placesField.status !== 'idle'}
				<div class="mt-3">
					<AutoSaveIndicator field={placesField} />
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
			{#each data.options.experienceLevels as level (level)}
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

	<!-- Corpus picks -->
	<Card padding="responsive">
		<ToggleSwitch
			bind:checked={corpusPicks}
			label="Find jobs for me from company career sites"
			description="Each night SJS looks through the openings on company career sites for ones that fit your profile and these settings, adds the best to your jobs marked “Fits your search”, and scores them. No search task needed, and it doesn't use your plan. Turning it off keeps the jobs found so far."
		/>
		{#if corpusPicks}
			<div class="mt-4 border-t border-[var(--dash-border)] pt-4">
				<p class="mb-2 text-xs text-[var(--dash-text-muted)]">At most this many a day:</p>
				<div class="flex flex-wrap gap-2">
					{#each PICKS_PER_DAY as n (n)}
						<button
							type="button"
							onclick={() => (picksPerDay = n)}
							class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors {picksPerDay ===
							n
								? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
								: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
						>
							<span
								class="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border {picksPerDay ===
								n
									? 'border-[var(--dash-primary)]'
									: 'border-[var(--dash-border)]'}"
							>
								{#if picksPerDay === n}
									<span class="h-2 w-2 rounded-full bg-[var(--dash-primary)]"></span>
								{/if}
							</span>
							{n}
						</button>
					{/each}
				</div>
				<p class="mt-2 text-xs text-[var(--dash-text-muted)]">
					The first night brings up to 50, from the openings of the last four months; after that
					only openings new since the night before.
				</p>
			</div>
		{/if}
		{#if picksField.status !== 'idle'}
			<div class="mt-3">
				<AutoSaveIndicator field={picksField} />
			</div>
		{/if}
	</Card>

	<!-- Pay -->
	<Card padding="responsive">
		<ToggleSwitch
			bind:checked={hideBelowAsk}
			label="Hide jobs that pay below my ask"
			description="Compares the most a job says it pays with your ask: a salary with your salary, a freelance or contract rate with your rate. Applies to Job Matches, Home and the email digest; the job list can still show them. Jobs that don't say what they pay are always shown."
		/>
		<p class="mt-3 text-xs text-[var(--dash-text-muted)]">
			{#if asksText}
				Your ask: {asksText}.
			{:else}
				You haven't set an ask yet, so nothing is hidden.
			{/if}
			<a
				href={resolve('/(app)/applications/salary')}
				class="text-[var(--dash-primary)] hover:underline"
				>{asksText ? 'Change it on Salary Prep' : 'Set one on Salary Prep'}</a
			>.
		</p>
		{#if hideBelowAsk}
			<div class="mt-4 border-t border-[var(--dash-border)] pt-4">
				<p class="mb-2 text-xs text-[var(--dash-text-muted)]">
					How far below your ask a job may pay and still show:
				</p>
				<div class="flex flex-wrap gap-2">
					{#each data.options.belowAskTolerances as pct (pct)}
						<button
							type="button"
							onclick={() => (belowAskTolerance = pct)}
							class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors {belowAskTolerance ===
							pct
								? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
								: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
						>
							<span
								class="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border {belowAskTolerance ===
								pct
									? 'border-[var(--dash-primary)]'
									: 'border-[var(--dash-border)]'}"
							>
								{#if belowAskTolerance === pct}
									<span class="h-2 w-2 rounded-full bg-[var(--dash-primary)]"></span>
								{/if}
							</span>
							{pct}%
						</button>
					{/each}
				</div>
				{#if data.belowAsk.compared > 0}
					{@const hidden = data.belowAsk.below[belowAskTolerance] ?? 0}
					<p class="mt-2 text-xs text-[var(--dash-text-muted)]">
						Right now this hides {hidden.toLocaleString()} of the {data.belowAsk.compared.toLocaleString()}
						matched {data.belowAsk.compared === 1 ? 'job' : 'jobs'} whose pay could be compared.
					</p>
				{/if}
			</div>
		{/if}
		{#if payField.status !== 'idle'}
			<div class="mt-3">
				<AutoSaveIndicator field={payField} />
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
					{#each communityTimeOptions as opt (opt.value)}
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
