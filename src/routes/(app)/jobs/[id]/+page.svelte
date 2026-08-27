<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faBan,
		faBriefcase,
		faBuilding,
		faCalendar,
		faCheck,
		faExternalLinkAlt,
		faGlobe,
		faMapMarkerAlt,
		faMoneyBillWave,
		faPaperPlane,
		faPenToSquare,
		faPlus,
		faBoxArchive,
		faSearch,
		faStar as faStarSolid,
		faSync,
		faTimes,
		faTrash,
		faUser,
		faWandMagicSparkles
	} from '@fortawesome/free-solid-svg-icons';
	import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
	import { track } from '$lib/tools/analytics';
	import { renderSafeMarkdown } from '$lib/utils/safe-markdown';
	import { normalizePostingMarkdown } from '$lib/utils/posting-markdown';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import ScoreBadge from '../components/ScoreBadge.svelte';
	import AddSkillToProfile from '../components/AddSkillToProfile.svelte';
	import PlatformLogo from '$lib/components/PlatformLogo.svelte';
	import RescrapeMonitor from '../../components/RescrapeMonitor.svelte';
	import Card from '../../components/Card.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import ConfirmModal from '../../profile/components/ConfirmModal.svelte';
	import JobFieldsForm, {
		emptyJobFields,
		type JobFields
	} from '../../components/JobFieldsForm.svelte';
	import { formatJobStatus, formatSalaryRange, timeAgo } from '$lib/format';
	import { normalizeSalaryPeriod, projectToHourly, formatCurrency } from '$lib/salary/conversion';
	import CategoryPill from '$lib/components/CategoryPill.svelte';
	import { page } from '$app/stores';
	import { formatDateLong, formatDateTime as fmtDateTime } from '$lib/format-date';
	import type { TimeFormat } from '$lib/format-date';
	import { adjacentFor, provenanceFor } from '$lib/match-provenance';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let job = $state(data.job);
	let match = $state(data.match);
	let jobStatus = $state(data.jobStatus);
	let isSaving = $state(false);
	let isRematching = $state(false);
	let rematchError = $state('');
	let showRematchConfirm = $state(false);
	let rematchFormEl: HTMLFormElement | undefined = $state();

	// Staff re-parse (re-extract structured fields from stored content)
	let isReparsing = $state(false);
	let reparseError = $state('');
	let showReparseConfirm = $state(false);
	let reparseFormEl: HTMLFormElement | undefined = $state();

	// Header-card editing (manually-created jobs only). One mode for the whole
	// block rather than a pencil per row: salary is four correlated inputs that
	// make no sense apart, and — the deciding reason — an empty field renders
	// nothing in view mode, so per-field editing gives you nothing to click to
	// *add* a missing company.
	let isEditingDetails = $state(false);
	let isSavingDetails = $state(false);
	let detailsError = $state('');
	// Filled by startEditingDetails() every time the form opens, so it always
	// reflects the row as last saved rather than as first rendered.
	let detailsFields = $state<JobFields>(emptyJobFields());

	/** Snapshot the job's current values into form strings. */
	function fieldsFromJob(): JobFields {
		const str = (v: string | number | null | undefined) => (v == null ? '' : String(v));
		const list = (v: unknown) => (Array.isArray(v) ? ([...v] as string[]) : []);
		return {
			title: str(job.title),
			company: str(job.company),
			job_poster: str(job.job_poster),
			office_location: str(job.office_location),
			source_url: str(job.source_url),
			// `date_posted` is a Drizzle date() column in string mode, so it already
			// arrives as the YYYY-MM-DD that <input type="date"> wants.
			date_posted: str(job.date_posted),
			salary_min: str(job.salary_min),
			salary_max: str(job.salary_max),
			salary_currency: str(job.salary_currency),
			// Through the normalizer, so a stored alias ("yearly") still selects its
			// canonical <option> instead of showing a blank dropdown.
			salary_period: str(normalizeSalaryPeriod(job.salary_period)),
			work_location: list(job.work_location),
			job_types: list(job.job_types),
			experience_levels: list(job.experience_levels)
		};
	}

	function startEditingDetails() {
		detailsFields = fieldsFromJob();
		detailsError = '';
		isEditingDetails = true;
	}

	/** Whether the details list has anything in it beyond the always-on date. */
	let hasDetailRows = $derived(
		!!(
			job.company ||
			job.office_location ||
			job.salary_min ||
			job.salary_max ||
			job.job_poster ||
			job.job_platform ||
			job.source_url
		)
	);

	// Description editing (manually-created jobs only)
	let isEditingDescription = $state(false);
	let descriptionDraft = $state(data.job.job_description ?? '');
	let isSavingDescription = $state(false);
	let descriptionError = $state('');
	let showSaveReparseConfirm = $state(false);
	let descriptionFormEl: HTMLFormElement | undefined = $state();
	// Set just before submit so one form serves both buttons.
	let descriptionReparse = $state('0');

	function startEditingDescription() {
		descriptionDraft = job.job_description ?? '';
		descriptionError = '';
		isEditingDescription = true;
	}

	// Company-profile editing. Its own editor rather than a field on the header
	// form: it is long-form prose in its own card, and unlike the description it
	// is NOT parse input, so it has no re-parse variant.
	let isEditingCompany = $state(false);
	let companyDraft = $state('');
	let isSavingCompany = $state(false);
	let companyError = $state('');

	function startEditingCompany() {
		companyDraft = job.company_description ?? '';
		companyError = '';
		isEditingCompany = true;
	}

	// Staff archive / delete
	let isArchiving = $state(false);
	let staffActionError = $state('');
	let showDeleteConfirm = $state(false);
	let deleteFormEl: HTMLFormElement | undefined = $state();
	let isArchived = $derived(job.status === 'archived');

	// Rescrape monitor modal — auto-show if a rescrape is in progress
	let rescrapeActive = ['queued', 'scraping'].includes(job.rescrape_status ?? '');
	let showRescrapeMonitor = $state(rescrapeActive);

	// Update status when form action completes
	$effect(() => {
		if (form?.success) {
			if (form.action === 'saved') {
				jobStatus = 'saved';
			} else if (form.action === 'unsaved') {
				jobStatus = 'new';
			} else if (form.action === 'rematched') {
				// Reload the page to get fresh match data from the server
				window.location.reload();
			} else if (form.action === 'archived') {
				job.status = form.status as string;
			} else if (form.status) {
				jobStatus = form.status as string;
			}
		}
	});

	let isSaved = $derived(jobStatus === 'saved');

	// Helper for matched skills highlighting
	const matchedSkillsSet = $derived(
		new Set(Array.isArray(match?.matched_skills) ? match.matched_skills : [])
	);

	let profileSkillLevels = $derived(data.profileSkillLevels);

	function getSkillMatchStrength(skill: string): 'strong' | 'weak' | null {
		if (!matchedSkillsSet.has(skill)) return null;
		const level = profileSkillLevels[skill.toLowerCase()];
		if (level === 'weak') return 'weak';
		return 'strong';
	}

	/**
	 * HOW it matched, which `getSkillMatchStrength` does not answer — that one
	 * reports the applicant's proficiency. Null on every row scored before
	 * `matched_skill_details` existed, and the pills render as they always did.
	 */
	function getSkillVia(skill: string) {
		return provenanceFor(match?.matched_skill_details, skill);
	}

	/** A held skill related to an UNMATCHED one — annotates the gap, never fills it. */
	function getRelatedFrom(skill: string) {
		return adjacentFor(match?.adjacent_skills, skill);
	}

	let profileSkillIndex = $derived(data.profileSkillIndex);

	/**
	 * What the profile holds for this skill, which is not the same question as
	 * whether the match counted it. `matched_skills` is the matcher's output for
	 * one job at one moment, so a skill added since (or one the LLM simply didn't
	 * pick up) reads as missing here while the profile has it all along. Knowing
	 * up front keeps the pill from offering to add a duplicate, and gives it the
	 * row to edit.
	 */
	function getProfileSkill(skill: string) {
		return profileSkillIndex[skill.trim().toLowerCase()] ?? null;
	}

	const tf = $derived(($page.data as { timeFormat: TimeFormat }).timeFormat);

	function formatDate(date: Date | string | null): string {
		return formatDateLong(date);
	}

	function formatDateTime(date: Date | string | null): string {
		return fmtDateTime(date, tf);
	}

	// formatSalary delegates to shared utility
	const formatSalary = formatSalaryRange;
</script>

<svelte:head>
	<title>{job?.title || 'Job'} - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header with Back Button -->
	<div>
		<a
			href="/jobs"
			onclick={(e) => {
				if (document.referrer && new URL(document.referrer).origin === location.origin) {
					e.preventDefault();
					history.back();
				}
			}}
			class="flex items-center gap-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
		>
			<FontAwesomeIcon icon={faArrowLeft} class="h-4 w-4" />
			<span class="text-sm">All Jobs</span>
		</a>
	</div>
	<SectionHeader
		title={isSaved ? 'Saved Job' : match ? 'Job Match' : 'Job Details'}
		icon={faBriefcase}
	/>

	<!-- Main Content -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Left Column - Job Details -->
		<div class="space-y-6 lg:col-span-2">
			<!-- Job Header Card -->
			<Card padding="lg">
				<!-- Score badge (floated) -->
				<div class="float-right mb-2 ml-4">
					<ScoreBadge score={match?.score ?? null} matched={!!match?.recommendation} size="xl" />
				</div>

				<!-- Header fields: view, or the whole block as one form -->
				{#if isEditingDetails}
					<form
						method="POST"
						action="?/updateDetails"
						use:enhance={() => {
							isSavingDetails = true;
							detailsError = '';
							return async ({ result, update }) => {
								isSavingDetails = false;
								if (result.type === 'failure') {
									detailsError = (result.data as { error?: string })?.error || 'Save failed';
									return;
								}
								// The saved row can differ from what was typed — a bare
								// "Remote" in the location box moves to the work arrangement,
								// the platform is re-resolved from the URL, salary period is
								// canonicalized. Take the reloaded row rather than guessing at
								// those locally. `reset: false` keeps the form's bound values
								// from being wiped on the way out.
								await update({ reset: false });
								job = data.job;
								isEditingDetails = false;
							};
						}}
					>
						<JobFieldsForm
							bind:fields={detailsFields}
							layout="flat"
							idPrefix="jd"
							titleSize="heading"
							disabled={isSavingDetails}
							datePostedHint="Empty shows the date the job was added instead."
						/>

						{#if detailsError}
							<p class="mt-3 text-sm text-red-500">{detailsError}</p>
						{/if}

						<div class="mt-5 flex flex-wrap items-center gap-2">
							<button
								type="submit"
								disabled={isSavingDetails}
								class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
							>
								{#if isSavingDetails}
									<Spinner size="w-4 h-4" />
								{/if}
								Save
							</button>

							<button
								type="button"
								disabled={isSavingDetails}
								onclick={() => (isEditingDetails = false)}
								class="rounded-lg px-4 py-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)] disabled:opacity-50"
							>
								Cancel
							</button>
						</div>
					</form>
				{:else}
					<!-- Title -->
					<div class="flex items-start justify-between gap-4">
						<h1 class="text-2xl font-bold text-[var(--dash-text)]">
							{job.title || 'Untitled Job'}
						</h1>
						{#if data.canEditContent}
							<button
								type="button"
								onclick={startEditingDetails}
								class="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
							>
								<FontAwesomeIcon icon={faPenToSquare} class="h-3.5 w-3.5" />
								Edit
							</button>
						{/if}
					</div>

					<!-- Tags (status, job types, work location) -->
					<div class="mt-3 flex flex-wrap gap-2">
						{#if job.status !== 'hiring'}
							<span
								class="rounded-full bg-[var(--dash-bg)] px-3 py-1 text-xs text-[var(--dash-text-muted)]"
							>
								{formatJobStatus(job.status)}
							</span>
						{/if}
						{#if job.job_types && Array.isArray(job.job_types)}
							{#each job.job_types as type}
								<CategoryPill category="job_type" value={type} />
							{/each}
						{/if}
						{#if job.work_location && Array.isArray(job.work_location)}
							{#each job.work_location as loc}
								<CategoryPill category="work_location" value={loc} />
							{/each}
						{/if}
						{#if job.experience_levels && Array.isArray(job.experience_levels)}
							{#each job.experience_levels as level}
								<CategoryPill category="experience_level" value={level} />
							{/each}
						{/if}
					</div>

					<!-- Details -->
					<div class="mt-4 mb-1 flex flex-col gap-2 text-sm">
						{#if job.company}
							<div class="flex items-center gap-1.5">
								<FontAwesomeIcon
									icon={faBuilding}
									class="h-3.5 w-3.5 text-[var(--dash-text-muted)]"
								/>
								<span class="text-[var(--dash-text-muted)]">Company</span>
								<span class="text-[var(--dash-text)]">{job.company}</span>
							</div>
						{/if}
						{#if job.office_location}
							<div class="flex items-center gap-1.5">
								<FontAwesomeIcon
									icon={faMapMarkerAlt}
									class="h-3.5 w-3.5 text-[var(--dash-text-muted)]"
								/>
								<span class="text-[var(--dash-text-muted)]">Location</span>
								<span class="text-[var(--dash-text)]">{job.office_location}</span>
							</div>
						{/if}
						{#if job.salary_min || job.salary_max}
							<div class="flex items-center gap-1.5">
								<FontAwesomeIcon
									icon={faMoneyBillWave}
									class="h-3.5 w-3.5 text-[var(--dash-text-muted)]"
								/>
								<span class="text-[var(--dash-text-muted)]">Salary</span>
								<span class="text-[var(--dash-text)]">
									{formatSalary(
										job.salary_min,
										job.salary_max,
										job.salary_currency,
										job.salary_period
									)}
									{#if job.salary_duration_weeks}
										<span class="text-[var(--dash-text-secondary)]">
											({job.salary_duration_weeks} week{job.salary_duration_weeks === 1 ? '' : 's'})
										</span>
									{/if}
								</span>
								{#if normalizeSalaryPeriod(job.salary_period) === 'project' && job.salary_duration_weeks && job.salary_min}
									<span class="text-xs text-[var(--dash-text-muted)]">
										≈ {formatCurrency(
											Math.round(projectToHourly(job.salary_min, job.salary_duration_weeks)),
											job.salary_currency || 'USD'
										)}/hr
									</span>
								{/if}
							</div>
						{/if}
						<div class="flex items-center gap-1.5">
							<FontAwesomeIcon
								icon={faCalendar}
								class="h-3.5 w-3.5 text-[var(--dash-text-muted)]"
							/>
							<span class="text-[var(--dash-text-muted)]">Posted</span>
							<span class="text-[var(--dash-text)]"
								>{timeAgo(job.date_posted || job.date_created)}</span
							>
							<span class="text-[var(--dash-text-muted)]/50"
								>{formatDate(job.date_posted || job.date_created)}</span
							>
						</div>
						{#if job.job_poster && job.job_poster !== job.job_platform?.name}
							<div class="flex items-center gap-1.5">
								<FontAwesomeIcon icon={faUser} class="h-3.5 w-3.5 text-[var(--dash-text-muted)]" />
								<span class="text-[var(--dash-text-muted)]">Posted by</span>
								<span class="text-[var(--dash-text)]">{job.job_poster}</span>
							</div>
						{/if}
						{#if job.job_platform}
							<div class="flex items-center gap-1.5">
								<FontAwesomeIcon icon={faGlobe} class="h-3.5 w-3.5 text-[var(--dash-text-muted)]" />
								<span class="text-[var(--dash-text-muted)]">Platform</span>
								<span class="text-[var(--dash-text)]">{job.job_platform.name}</span>
							</div>
						{/if}
						{#if job.source_url}
							<div class="flex items-center gap-1.5">
								<FontAwesomeIcon
									icon={faExternalLinkAlt}
									class="h-3.5 w-3.5 text-[var(--dash-text-muted)]"
								/>
								<span class="text-[var(--dash-text-muted)]">Source</span>
								<a
									href={job.source_url}
									target="_blank"
									rel="noopener"
									class="truncate text-[var(--dash-primary)] transition-colors hover:text-[var(--dash-primary-hover)]"
								>
									{job.source_url.replace(/^https?:\/\/(?:www\.)?/, '')}
								</a>
							</div>
						{/if}

						<!-- Empty fields render nothing above, so a job with only its date
                 would otherwise show no way in. -->
						{#if data.canEditContent && !hasDetailRows}
							<button
								type="button"
								onclick={startEditingDetails}
								class="flex items-center gap-1.5 self-start text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-primary)]"
							>
								<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
								Add the company, location and salary
							</button>
						{/if}
					</div>
				{/if}

				<!-- Action Buttons (footer) -->
				<div
					class="-mx-6 mt-4 -mb-6 flex flex-wrap items-center gap-2 border-t border-[var(--dash-border)] px-6 py-4"
				>
					<form
						method="POST"
						action="?/updateStatus"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
							};
						}}
					>
						<input
							type="hidden"
							name="status"
							value={jobStatus === 'rejected' ? 'new' : 'rejected'}
						/>
						<button
							type="submit"
							class="
                flex items-center justify-center gap-2 rounded-lg border px-4 py-2 whitespace-nowrap transition-colors {jobStatus ===
							'rejected'
								? 'border-red-500 bg-red-500 text-white'
								: 'border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'}
              "
							title="Not interested in this job"
						>
							<FontAwesomeIcon icon={faBan} class="h-4 w-4" />
							Not Interested
						</button>
					</form>

					<form
						method="POST"
						action={isSaved ? '?/unsaveJob' : '?/saveJob'}
						use:enhance={() => {
							isSaving = true;
							const wasSaved = isSaved;
							return async ({ result, update }) => {
								if (result.type === 'success' && !wasSaved) {
									track('job_saved');
								}
								await update();
								isSaving = false;
							};
						}}
					>
						<button
							type="submit"
							disabled={isSaving}
							class="
                flex items-center justify-center gap-2 rounded-lg border px-4 py-2 whitespace-nowrap transition-colors {isSaved
								? 'border-[var(--dash-primary)] bg-[var(--dash-primary)] text-white'
								: 'border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'} disabled:opacity-50
              "
							title={isSaved ? 'Unsave job' : 'Save job'}
						>
							<FontAwesomeIcon icon={isSaved ? faStarSolid : faStarRegular} class="h-4 w-4" />
							{isSaved ? 'Saved' : 'Save'}
						</button>
					</form>

					<div class="ml-auto">
						{#if data.existingApplication}
							<a
								href="/applications/{data.existingApplication.id}"
								class="flex items-center gap-2 rounded-lg border border-[var(--dash-success)] bg-[var(--dash-success-light)] px-4 py-2 whitespace-nowrap text-[var(--dash-success)] transition-colors hover:bg-[var(--dash-success)] hover:text-white"
							>
								<FontAwesomeIcon icon={faPaperPlane} class="h-4 w-4" />
								View Application
								<span class="text-xs capitalize">({data.existingApplication.status})</span>
							</a>
						{:else}
							<form
								method="POST"
								action="?/startApplication"
								use:enhance={() =>
									async ({ result, update }) => {
										if (result.type === 'redirect' || result.type === 'success') {
											track('application_created');
										}
										await update();
									}}
							>
								<button
									type="submit"
									class="flex items-center justify-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 whitespace-nowrap text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
								>
									<FontAwesomeIcon icon={faPaperPlane} class="h-4 w-4" />
									Start Application
								</button>
							</form>
						{/if}
					</div>
				</div>
			</Card>

			<!-- Skills -->
			{#if (job.skills_required && Array.isArray(job.skills_required) && job.skills_required.length > 0) || (job.skills_preferred && Array.isArray(job.skills_preferred) && job.skills_preferred.length > 0)}
				<Card padding="lg">
					<h2 class="mb-4 text-lg font-semibold text-[var(--dash-text)]">Skills</h2>

					{#if job.skills_required && Array.isArray(job.skills_required) && job.skills_required.length > 0}
						<div class="mb-4">
							<p
								class="mb-2 text-xs font-semibold tracking-wide text-[var(--dash-text-muted)] uppercase"
							>
								Required
							</p>
							<div class="flex flex-wrap gap-2">
								{#each job.skills_required as skill}
									{@const via = getSkillVia(skill)}
									<AddSkillToProfile
										{skill}
										strength={getSkillMatchStrength(skill)}
										via={via?.via ?? null}
										from={via?.from ?? null}
										relatedFrom={getRelatedFrom(skill)}
										profileSkill={getProfileSkill(skill)}
										variant="required"
									/>
								{/each}
							</div>
						</div>
					{/if}

					{#if job.skills_preferred && Array.isArray(job.skills_preferred) && job.skills_preferred.length > 0}
						<div>
							<p
								class="mb-2 text-xs font-semibold tracking-wide text-[var(--dash-text-muted)] uppercase"
							>
								Preferred
							</p>
							<div class="flex flex-wrap gap-2">
								{#each job.skills_preferred as skill}
									{@const via = getSkillVia(skill)}
									<AddSkillToProfile
										{skill}
										strength={getSkillMatchStrength(skill)}
										via={via?.via ?? null}
										from={via?.from ?? null}
										relatedFrom={getRelatedFrom(skill)}
										profileSkill={getProfileSkill(skill)}
										variant="preferred"
									/>
								{/each}
							</div>
						</div>
					{/if}
				</Card>
			{/if}

			<!-- Job Description -->
			{#if job.job_description || data.canEditContent}
				<Card padding="lg">
					<div class="mb-4 flex items-start justify-between gap-4">
						<h2 class="text-lg font-semibold text-[var(--dash-text)]">Job Description</h2>
						{#if data.canEditContent && !isEditingDescription}
							<button
								type="button"
								onclick={startEditingDescription}
								class="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
							>
								<FontAwesomeIcon icon={faPenToSquare} class="h-3.5 w-3.5" />
								{job.job_description ? 'Edit' : 'Add description'}
							</button>
						{/if}
					</div>

					{#if isEditingDescription}
						<form
							bind:this={descriptionFormEl}
							method="POST"
							action="?/updateDescription"
							use:enhance={({ formData }) => {
								// Set here rather than via a hidden input: the flag is decided
								// by which button submitted, and a bound input wouldn't have
								// flushed to the DOM before requestSubmit().
								formData.set('reparse', descriptionReparse);
								isSavingDescription = true;
								descriptionError = '';
								return async ({ result }) => {
									isSavingDescription = false;
									if (result.type === 'failure') {
										descriptionError = (result.data as { error?: string })?.error || 'Save failed';
										return;
									}
									if (descriptionReparse === '1') {
										// Re-parse rewrote most fields — reload to show them.
										window.location.reload();
										return;
									}
									job.job_description = descriptionDraft.trim();
									isEditingDescription = false;
								};
							}}
						>
							<textarea
								name="description"
								bind:value={descriptionDraft}
								rows="12"
								disabled={isSavingDescription}
								class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 font-mono text-sm leading-relaxed text-[var(--dash-text)] focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none disabled:opacity-50"
							></textarea>

							{#if descriptionError}
								<p class="mt-2 text-sm text-red-500">{descriptionError}</p>
							{/if}

							<div class="mt-3 flex flex-wrap items-center gap-2">
								<button
									type="submit"
									disabled={isSavingDescription}
									onclick={() => (descriptionReparse = '0')}
									aria-label="Save description"
									class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
								>
									{#if isSavingDescription && descriptionReparse === '0'}
										<Spinner size="w-4 h-4" />
									{/if}
									Save
								</button>

								<button
									type="button"
									disabled={isSavingDescription}
									onclick={() => (showSaveReparseConfirm = true)}
									class="flex items-center gap-2 rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)] disabled:opacity-50"
									title="Save, then re-extract skills, salary and other fields from the new text and re-score the job"
								>
									{#if isSavingDescription && descriptionReparse === '1'}
										<Spinner size="w-4 h-4" />
									{:else}
										<FontAwesomeIcon icon={faWandMagicSparkles} class="h-4 w-4" />
									{/if}
									{isSavingDescription && descriptionReparse === '1'
										? 'Re-parsing...'
										: 'Save & re-parse'}
								</button>

								<button
									type="button"
									disabled={isSavingDescription}
									onclick={() => (isEditingDescription = false)}
									class="rounded-lg px-4 py-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)] disabled:opacity-50"
								>
									Cancel
								</button>
							</div>
						</form>
					{:else if job.job_description}
						<!--
              Two authors, one field: the scraper writes stripped HTML and the
              assistant writes markdown. Rendered as plain text this showed the
              assistant's `**headings**` as literal asterisks; rendered as
              markdown without normalizePostingMarkdown it would show the
              scraper's indented lists as code blocks. See posting-markdown.ts.
            -->
						<div class="posting-md max-w-none text-[var(--dash-text)]">
							<!--
              renderSafeMarkdown escapes raw HTML tokens to inert text and
              allowlists link/image schemes to http(s)/mailto — the same audited
              sink the four other markdown surfaces use. The input here is
              scraper output and LLM output; both are untrusted, and neither
              reaches the DOM as markup.
            -->
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html renderSafeMarkdown(normalizePostingMarkdown(job.job_description), {
								breaks: true
							})}
						</div>
					{:else}
						<p class="text-sm text-[var(--dash-text-muted)]">This job has no description yet.</p>
					{/if}
				</Card>
			{/if}

			<!-- Company Description -->
			{#if job.company_description || data.canEditContent}
				<Card padding="lg">
					<div class="mb-4 flex items-start justify-between gap-4">
						<h2 class="text-lg font-semibold text-[var(--dash-text)]">
							About {job.company || 'the Company'}
						</h2>
						{#if data.canEditContent && !isEditingCompany}
							<button
								type="button"
								onclick={startEditingCompany}
								class="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
							>
								<FontAwesomeIcon icon={faPenToSquare} class="h-3.5 w-3.5" />
								{job.company_description ? 'Edit' : 'Add company profile'}
							</button>
						{/if}
					</div>

					{#if isEditingCompany}
						<form
							method="POST"
							action="?/updateCompanyDescription"
							use:enhance={() => {
								isSavingCompany = true;
								companyError = '';
								return async ({ result }) => {
									isSavingCompany = false;
									if (result.type === 'failure') {
										companyError = (result.data as { error?: string })?.error || 'Save failed';
										return;
									}
									job.company_description = companyDraft.trim() || null;
									isEditingCompany = false;
								};
							}}
						>
							<textarea
								name="company_description"
								bind:value={companyDraft}
								rows="8"
								disabled={isSavingCompany}
								aria-label="About the company"
								class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-sm leading-relaxed text-[var(--dash-text)] focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none disabled:opacity-50"
							></textarea>

							<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
								Who the company is, not what the role is. Leave empty to remove it.
							</p>

							{#if companyError}
								<p class="mt-2 text-sm text-red-500">{companyError}</p>
							{/if}

							<div class="mt-3 flex flex-wrap items-center gap-2">
								<button
									type="submit"
									disabled={isSavingCompany}
									class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
								>
									{#if isSavingCompany}
										<Spinner size="w-4 h-4" />
									{/if}
									Save
								</button>

								<button
									type="button"
									disabled={isSavingCompany}
									onclick={() => (isEditingCompany = false)}
									class="rounded-lg px-4 py-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)] disabled:opacity-50"
								>
									Cancel
								</button>
							</div>
						</form>
					{:else if job.company_description}
						<div class="posting-md max-w-none text-[var(--dash-text)]">
							<!-- Same audited sink as the description above. -->
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html renderSafeMarkdown(normalizePostingMarkdown(job.company_description), {
								breaks: true
							})}
						</div>
					{:else}
						<p class="text-sm text-[var(--dash-text-muted)]">Nothing about the company yet.</p>
					{/if}
				</Card>
			{/if}
		</div>

		<!-- Right Column -->
		<div class="space-y-6">
			<!-- Match Analysis Card -->
			<Card padding="lg">
				<h2 class="mb-4 text-lg font-semibold text-[var(--dash-text)]">Match Analysis</h2>

				{#if match && match.recommendation === 'filtered_out'}
					<!-- Filtered out - didn't pass eligibility -->
					<p class="mb-3 text-sm text-[var(--dash-text-secondary)]">
						This job was filtered out before AI scoring because it doesn't fit your profile
						preferences.
					</p>

					{#if match.gaps && Array.isArray(match.gaps) && match.gaps.length > 0}
						<ul class="space-y-2">
							{#each match.gaps as gap}
								<li class="flex items-start gap-2 text-sm">
									<FontAwesomeIcon icon={faTimes} class="mt-1 h-3 w-3 flex-shrink-0 text-red-500" />
									<span class="text-[var(--dash-text)]">{gap}</span>
								</li>
							{/each}
						</ul>
					{/if}
				{:else if match && match.recommendation}
					<!-- AI-scored match -->
					{#if match.strengths && Array.isArray(match.strengths) && match.strengths.length > 0}
						<div class="mb-4">
							<p class="mb-2 text-sm text-[var(--dash-text-secondary)]">Strengths</p>
							<ul class="space-y-1">
								{#each match.strengths as strength}
									<li class="flex items-start gap-2 text-sm">
										<FontAwesomeIcon
											icon={faCheck}
											class="mt-1 h-3 w-3 flex-shrink-0 text-green-600"
										/>
										<span class="text-[var(--dash-text)]">{strength}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if match.gaps && Array.isArray(match.gaps) && match.gaps.length > 0}
						<div>
							<p class="mb-2 text-sm text-[var(--dash-text-secondary)]">Gaps</p>
							<ul class="space-y-1">
								{#each match.gaps as gap}
									<li class="flex items-start gap-2 text-sm">
										<FontAwesomeIcon
											icon={faTimes}
											class="mt-1 h-3 w-3 flex-shrink-0 text-red-500"
										/>
										<span class="text-[var(--dash-text)]">{gap}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				{:else}
					<!-- Not yet matched -->
					<p class="text-sm text-[var(--dash-text-muted)]">
						This job hasn't been scored against your profile yet.
					</p>
				{/if}
			</Card>

			<!-- Staff: Metadata + Actions -->
			{#if data.isStaff}
				<Card padding="lg">
					<h2 class="mb-4 text-lg font-semibold text-[var(--dash-text)]">Staff Tools</h2>

					<!-- Action buttons -->
					<div class="mb-4 flex flex-wrap gap-2">
						{#if job.source_url}
							<button
								type="button"
								onclick={() => (showRescrapeMonitor = true)}
								class="flex items-center gap-2 rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
								title="Re-fetch job data from source"
							>
								<FontAwesomeIcon icon={faSync} class="h-4 w-4" />
								Rescrape
							</button>
						{/if}

						{#if job.job_description || job.source_html_stripped}
							<form
								bind:this={reparseFormEl}
								method="POST"
								action="?/reparseJob"
								use:enhance={() => {
									isReparsing = true;
									reparseError = '';
									return async ({ result }) => {
										if (result.type === 'failure') {
											reparseError =
												(result.data as { error?: string })?.error || 'Re-parse failed';
											isReparsing = false;
										} else {
											// Many fields changed — reload to show the fresh extraction.
											window.location.reload();
										}
									};
								}}
							>
								<button
									type="button"
									onclick={() => (showReparseConfirm = true)}
									disabled={isReparsing}
									class="flex items-center gap-2 rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)] disabled:opacity-50"
									title="Re-extract fields (skills, salary, etc.) from the stored description — no re-fetch"
								>
									{#if isReparsing}
										<Spinner size="w-4 h-4" />
									{:else}
										<FontAwesomeIcon icon={faWandMagicSparkles} class="h-4 w-4" />
									{/if}
									{isReparsing ? 'Re-parsing...' : 'Re-parse'}
								</button>
							</form>
						{/if}

						<form
							bind:this={rematchFormEl}
							method="POST"
							action="?/rematchJob"
							use:enhance={() => {
								isRematching = true;
								rematchError = '';
								return async ({ result, update }) => {
									if (result.type === 'failure') {
										rematchError = (result.data as { error?: string })?.error || 'Scoring failed';
										isRematching = false;
									} else {
										await update();
										isRematching = false;
									}
								};
							}}
						>
							<button
								type={match?.recommendation ? 'button' : 'submit'}
								onclick={match?.recommendation ? () => (showRematchConfirm = true) : undefined}
								disabled={isRematching}
								class="flex items-center gap-2 rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)] disabled:opacity-50"
								title={match?.recommendation
									? 'Re-run AI scoring for this job'
									: 'Run AI scoring for this job'}
							>
								{#if isRematching}
									<Spinner size="w-4 h-4" />
								{:else}
									<FontAwesomeIcon
										icon={match?.recommendation ? faSync : faSearch}
										class="h-4 w-4"
									/>
								{/if}
								{isRematching ? 'Scoring...' : match?.recommendation ? 'Re-score' : 'Score'}
							</button>
						</form>

						<!-- Archive / Unarchive -->
						<form
							method="POST"
							action="?/archiveJob"
							use:enhance={() => {
								isArchiving = true;
								staffActionError = '';
								return async ({ result, update }) => {
									if (result.type === 'failure') {
										staffActionError =
											(result.data as { error?: string })?.error || 'Archive failed';
									} else {
										await update();
									}
									isArchiving = false;
								};
							}}
						>
							<button
								type="submit"
								disabled={isArchiving}
								class="flex items-center gap-2 rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)] disabled:opacity-50"
								title={isArchived
									? 'Restore this job (sets status to published)'
									: 'Hide this job from listings and match counts'}
							>
								{#if isArchiving}
									<Spinner size="w-4 h-4" />
								{:else}
									<FontAwesomeIcon icon={faBoxArchive} class="h-4 w-4" />
								{/if}
								{isArchived ? 'Unarchive' : 'Archive'}
							</button>
						</form>

						<!-- Delete -->
						<form
							bind:this={deleteFormEl}
							method="POST"
							action="?/deleteJob"
							use:enhance={() => {
								staffActionError = '';
								return async ({ result }) => {
									if (result.type === 'failure') {
										staffActionError =
											(result.data as { error?: string })?.error || 'Delete failed';
									} else if (result.type === 'redirect') {
										window.location.href = result.location;
									}
								};
							}}
						>
							<button
								type="button"
								onclick={() => (showDeleteConfirm = true)}
								class="flex items-center gap-2 rounded-lg border border-[var(--dash-error)] px-4 py-2 text-[var(--dash-error)] transition-colors hover:bg-[var(--dash-error-light)]"
								title="Permanently delete this job"
							>
								<FontAwesomeIcon icon={faTrash} class="h-4 w-4" />
								Delete
							</button>
						</form>
					</div>

					<!-- Re-match Error -->
					{#if rematchError}
						<div
							class="mb-4 rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-3"
						>
							<p class="text-sm text-[var(--dash-error)]">
								<strong>Scoring failed:</strong>
								{rematchError}
							</p>
						</div>
					{/if}

					<!-- Re-parse Error -->
					{#if reparseError}
						<div
							class="mb-4 rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-3"
						>
							<p class="text-sm text-[var(--dash-error)]">
								<strong>Re-parse failed:</strong>
								{reparseError}
							</p>
						</div>
					{/if}

					<!-- Archive / Delete Error -->
					{#if staffActionError}
						<div
							class="mb-4 rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-3"
						>
							<p class="text-sm text-[var(--dash-error)]">
								{staffActionError}
							</p>
						</div>
					{/if}

					<!-- Metadata -->
					<dl class="space-y-2 text-sm">
						<div class="flex justify-between">
							<dt class="text-[var(--dash-text-secondary)]">Job ID</dt>
							<dd class="text-[var(--dash-text)]">{job.id}</dd>
						</div>
						<!-- The jobs table has no source_id column; previous "Source ID"
                 row referenced a field that doesn't exist in the schema. -->

						<div class="flex justify-between">
							<dt class="text-[var(--dash-text-secondary)]">Added</dt>
							<dd class="text-[var(--dash-text)]">
								{timeAgo(job.date_created)}
								<span class="text-[var(--dash-text-muted)]/50">{formatDate(job.date_created)}</span>
							</dd>
						</div>
					</dl>

					<!-- Imported By -->
					{#if data.importers.length > 0}
						<div class="mt-4">
							<p class="mb-2 text-sm text-[var(--dash-text-secondary)]">Imported By</p>
							<ul class="space-y-1 text-sm text-[var(--dash-text)]">
								{#each data.importers as imp}
									<li>
										<span class="font-medium">{imp.profileName}</span>
										{#if imp.scrapedAt}
											<span class="text-[var(--dash-text-muted)]">
												— {formatDateTime(imp.scrapedAt)}
											</span>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Match History -->
					{#if data.matchHistory.length > 0}
						<div class="mt-4">
							<p class="mb-2 text-sm text-[var(--dash-text-secondary)]">Match History</p>
							<ul class="space-y-2 text-sm">
								{#each data.matchHistory as entry}
									<li class="flex items-start justify-between gap-2">
										<div class="text-[var(--dash-text)]">
											<span class="font-medium">{entry.score}/100</span>
											{#if entry.skill_match_percentage != null}
												<span class="text-[var(--dash-text-muted)]"
													>({entry.skill_match_percentage}% skills)</span
												>
											{/if}
											{#if entry.recommendation}
												<span class="text-[var(--dash-text-muted)]"
													>— {entry.recommendation.replace(/_/g, ' ')}</span
												>
											{/if}
										</div>
										<span class="shrink-0 whitespace-nowrap text-[var(--dash-text-muted)]"
											>{formatDateTime(entry.date_created)}</span
										>
									</li>
								{/each}
							</ul>
						</div>
					{:else if match}
						<div class="mt-4">
							<p class="mb-2 text-sm text-[var(--dash-text-secondary)]">Match Info</p>
							<dl class="space-y-1 text-sm">
								<div class="flex justify-between">
									<dt class="text-[var(--dash-text-secondary)]">Matched</dt>
									<dd class="text-[var(--dash-text)]">{formatDateTime(match.date_created)}</dd>
								</div>
								<div class="flex justify-between">
									<dt class="text-[var(--dash-text-secondary)]">Score</dt>
									<dd class="text-[var(--dash-text)]">{match.score}/100</dd>
								</div>
								<div class="flex justify-between">
									<dt class="text-[var(--dash-text-secondary)]">Recommendation</dt>
									<dd class="text-[var(--dash-text)]">
										{match.recommendation?.replace(/_/g, ' ') ?? '—'}
									</dd>
								</div>
							</dl>
						</div>
					{/if}

					<!-- Scrape History -->
					{#if data.scrapeHistory.length > 0}
						<div class="mt-4">
							<p class="mb-2 text-sm text-[var(--dash-text-secondary)]">Scrape History</p>
							<ul class="space-y-1 text-sm text-[var(--dash-text)]">
								{#each data.scrapeHistory as entry}
									<li>{formatDateTime(entry.processed_at)}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</Card>
			{/if}
		</div>
	</div>
</div>

{#if showRescrapeMonitor}
	<RescrapeMonitor
		jobId={job.id}
		sourceUrl={job.source_url}
		platformName={job.job_platform?.name ?? null}
		platformCredentials={data.rescrapeConfig?.platformCredentials ?? []}
		platformId={data.rescrapeConfig?.platformId ?? 0}
		profileId={data.profileId}
		selectedCredentialId={data.rescrapeConfig?.selectedCredentialId ?? 'none'}
		loginUrl={data.rescrapeConfig?.loginUrl ?? null}
		defaultBrowserProvider={data.rescrapeConfig?.browserProvider ?? null}
		defaultKeepMinimized={data.rescrapeConfig?.keepMinimized ?? true}
		defaultCountryCode={data.rescrapeConfig?.defaultCountryCode ?? ''}
		browserFingerprint={data.rescrapeConfig?.browserFingerprint ?? {
			language: '',
			timezone: '',
			userAgent: ''
		}}
		browserFingerprintDefaults={data.rescrapeConfig?.browserFingerprintDefaults ?? {
			language: 'en-US,en',
			timezone: 'America/New_York'
		}}
		initialStatus={job.rescrape_status ?? undefined}
		onclose={() => (showRescrapeMonitor = false)}
		oncomplete={() => window.location.reload()}
	/>
{/if}

<ConfirmModal
	isOpen={showRematchConfirm}
	title="Re-score Job"
	message="This will re-run AI scoring for this job, replacing the current score. This uses AI usage."
	confirmLabel="Re-score"
	variant="primary"
	onCancel={() => (showRematchConfirm = false)}
	onConfirm={() => {
		showRematchConfirm = false;
		rematchFormEl?.requestSubmit();
	}}
/>

<ConfirmModal
	isOpen={showReparseConfirm}
	title="Re-parse Job"
	message="Re-extract skills, location, salary and other fields from the stored description, overwriting the current values for all users. Uses AI usage and re-scores the job afterwards."
	confirmLabel="Re-parse"
	variant="primary"
	onCancel={() => (showReparseConfirm = false)}
	onConfirm={() => {
		showReparseConfirm = false;
		reparseFormEl?.requestSubmit();
	}}
/>

<ConfirmModal
	isOpen={showSaveReparseConfirm}
	title="Save & Re-parse"
	message="Save the description, then re-extract the title, skills, location, salary and other fields from it — overwriting the current values, including any you set by hand. Uses AI usage and re-scores the job afterwards."
	confirmLabel="Save & re-parse"
	variant="primary"
	onCancel={() => (showSaveReparseConfirm = false)}
	onConfirm={() => {
		showSaveReparseConfirm = false;
		descriptionReparse = '1';
		descriptionFormEl?.requestSubmit();
	}}
/>

<ConfirmModal
	isOpen={showDeleteConfirm}
	title="Delete Job"
	message={`Permanently delete "${job.title}"? This removes the job for all users and cannot be undone. Use Archive instead to just hide it.`}
	confirmLabel="Delete"
	variant="destructive"
	onCancel={() => (showDeleteConfirm = false)}
	onConfirm={() => {
		showDeleteConfirm = false;
		deleteFormEl?.requestSubmit();
	}}
/>

<style>
	/* Markdown in a job posting. Same shape as AgentChat's .agent-md — the
	   tree has no typography plugin, so a rendered list has no bullets and a
	   heading no weight unless said here. */
	.posting-md :global(p) {
		margin: 0 0 0.75rem;
	}
	.posting-md :global(p:last-child) {
		margin-bottom: 0;
	}
	.posting-md :global(ul),
	.posting-md :global(ol) {
		margin: 0.25rem 0 0.75rem;
		padding-left: 1.25rem;
		list-style: revert;
	}
	.posting-md :global(li) {
		margin: 0.2rem 0;
	}
	.posting-md :global(h1),
	.posting-md :global(h2),
	.posting-md :global(h3),
	.posting-md :global(h4) {
		margin: 1rem 0 0.4rem;
		font-weight: 600;
		font-size: 1em;
	}
	.posting-md :global(strong) {
		font-weight: 600;
	}
	.posting-md :global(a) {
		color: var(--dash-primary);
		text-decoration: underline;
	}
	.posting-md :global(hr) {
		margin: 1rem 0;
		border-color: var(--dash-border);
	}
</style>
