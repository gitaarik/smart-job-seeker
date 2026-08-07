<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowRight,
		faBuilding,
		faCalendar,
		faCheck,
		faChevronDown,
		faClipboardList,
		faEnvelope,
		faExternalLinkAlt,
		faFileAlt,
		faCalendarCheck,
		faClock,
		faGlobe,
		faHandPointRight,
		faMapMarkerAlt,
		faPencil,
		faMoneyBillWave,
		faStickyNote,
		faWrench,
		faTrash,
		faPlus,
		faTimes
	} from '@fortawesome/free-solid-svg-icons';
	import ConfirmModal from '../../profile/components/ConfirmModal.svelte';
	import Card from '../../components/Card.svelte';
	import CategoryPill from '$lib/components/CategoryPill.svelte';
	import {
		getStatusLabel,
		getStatusDotColor,
		getStatusBgColor,
		getStatusColor,
		getQuickStatusActions
	} from '$lib/application-status';
	import StatusStepper from './StatusStepper.svelte';
	import CvSentCard from './CvSentCard.svelte';
	import ActivitySummaryCard from './ActivitySummaryCard.svelte';
	import OfferCard from './OfferCard.svelte';
	import DetailsCard from './DetailsCard.svelte';
	import { hasOfferContent } from '$lib/application-offer';
	import { formatSalaryRange, isSalarySingleValue, timeAgo } from '$lib/format';
	import { formatDate as fmtDate } from '$lib/format-date';
	import { profileDocUrl } from '$lib/utils/profile-doc-url';
	import type { DocType } from '$lib/utils/profile-doc-url';
	import { linkify } from '$lib/utils/linkify';
	import { portalToBody } from '$lib/actions/portal';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let app = $derived(data.application);
	let job = $derived(app.job);
	let profileSlug = $derived((data as any).selectedProfile?.slug as string | undefined);

	// Notes
	type Note = { id: string; text: string; created_at: string };
	let notes = $derived([...((app.application_notes || []) as Note[])].reverse());
	let newNoteText = $state('');
	let addingNote = $state(false);
	let newNoteInput = $state<HTMLTextAreaElement | null>(null);
	let editingNoteId = $state<string | null>(null);
	let editingNoteText = $state('');
	let confirmingDeleteId = $state<string | null>(null);

	function autoResizeOnMount(el: HTMLTextAreaElement) {
		el.style.height = 'auto';
		el.style.height = el.scrollHeight + 'px';
		el.focus();
	}

	// Status widget
	let statusPickerOpen = $state(false);
	let statusSaving = $state(false);
	let quickSaving = $state(false);
	let quickActions = $derived(getQuickStatusActions(app.status, app.status_step));

	const quickToneClass: Record<string, string> = {
		advance:
			'border-[var(--dash-primary)] text-[var(--dash-primary)] hover:bg-[var(--dash-primary)]/10',
		positive: 'border-green-400 text-green-600 hover:bg-green-50',
		negative:
			'border-[var(--dash-border)] text-[var(--dash-text-muted)] hover:border-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)]'
	};

	function formatDate(date: Date | string | null): string {
		return fmtDate(date, { fallback: '' });
	}

	function formatRelativeDate(date: Date | string | null): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
		return formatDate(date);
	}

	function formatCurrency(
		amount: number | string | null,
		currency: string | null,
		period: string | null
	): string {
		if (!amount) return 'Not set';
		const formatted = new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency || 'EUR',
			maximumFractionDigits: 0
		}).format(Number(amount));
		return period ? `${formatted} / ${period}` : formatted;
	}

	const letterTypeLabels: Record<string, string> = {
		cover_letter: 'Cover Letter',
		cheat_sheet: 'Interview Cheat Sheet'
	};

	let letterCount = $derived(app.application_letters?.length || 0);
	let questionCount = $derived(app.application_questions?.length || 0);
	let fileCount = $derived((app.application_records ?? []).filter((r) => r.file_id).length);
	// The entries the summariser reads: an extraction with no text in it is not
	// one it could have summarised, so counting rows would overstate what the
	// absence of a summary means. `has_content` is computed in the layout query
	// rather than derived from the text, which this page no longer receives.
	let summarisedEntryCount = $derived(
		(app.application_records ?? []).filter((r) => r.has_content).length
	);
	let activityHref = $derived(`/applications/${app.id}/activity`);
	let statusLogCount = $derived(app.application_status_logs?.length || 0);
	let recentStatusLog = $derived(app.application_status_logs?.slice(0, 5) || []);

	let showDeleteConfirm = $state(false);
	let showMore = $state(false);
</script>

{#if form?.error}
	<div class="mb-6 rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
		<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
	</div>
{/if}

<div class="space-y-6 pb-8">
	<!-- Title -->
	<h2 class="text-2xl font-bold text-[var(--dash-text)]">
		{job?.title || 'Untitled Position'}
	</h2>

	<!-- Status Widget (top of page) -->
	<Card padding="lg">
		<div class="space-y-3">
			<div class="mb-2 flex items-center gap-2">
				<FontAwesomeIcon icon={faClipboardList} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
				<h2 class="text-sm font-semibold tracking-wide text-[var(--dash-text)] uppercase">
					Status
				</h2>
			</div>

			<button
				type="button"
				onclick={() => (statusPickerOpen = true)}
				class="flex w-full items-center gap-5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-5 py-4 text-left transition-colors hover:border-[var(--dash-primary)]"
			>
				<div class="min-w-0 flex-1 space-y-1.5">
					<p class="text-sm font-semibold tracking-wide uppercase {getStatusDotColor(app.status)}">
						{getStatusLabel(app.status)}
					</p>
					{#if app.status_step}
						<p class="text-sm text-[var(--dash-text-secondary)] italic">{app.status_step}</p>
					{/if}
					{#if app.status_action}
						{@const isWaiting = app.status_action.startsWith('Awaiting')}
						{@const isScheduled = app.status_action === 'Scheduled'}
						<p
							class="flex items-center gap-1.5 text-sm font-medium {isWaiting
								? 'text-[var(--dash-text-muted)]'
								: isScheduled
									? 'text-[var(--dash-success)]'
									: 'text-[var(--dash-primary)]'}"
						>
							{#key app.status_action}
								<FontAwesomeIcon
									icon={isWaiting ? faClock : isScheduled ? faCalendarCheck : faHandPointRight}
									class="h-3.5 w-3.5"
								/>
							{/key}
							{app.status_action}
							{#if isScheduled && app.status_action_date}
								— {formatDate(app.status_action_date)}
							{/if}
						</p>
					{/if}
				</div>
				<span
					class="inline-flex flex-shrink-0 items-center gap-1.5 text-xs text-[var(--dash-text-muted)]"
				>
					<FontAwesomeIcon icon={faPencil} class="h-3 w-3" />
					Edit
				</span>
			</button>

			<!-- Quick update: one-tap transitions for the current phase -->
			{#if quickActions.length > 0}
				<div class="pt-1">
					<p class="mb-2 text-xs text-[var(--dash-text-muted)]">Quick update</p>
					<div class="flex flex-wrap gap-2">
						{#each quickActions as qa (qa.label)}
							<form
								method="POST"
								action="?/updateStatus"
								use:enhance={() => {
									quickSaving = true;
									return async ({ update }) => {
										await update();
										quickSaving = false;
									};
								}}
							>
								<input type="hidden" name="status" value={qa.status} />
								<input type="hidden" name="step" value={qa.step ?? ''} />
								<input type="hidden" name="action" value={qa.action ?? ''} />
								<button
									type="submit"
									disabled={quickSaving}
									class="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 {quickToneClass[
										qa.tone
									]}"
								>
									{qa.label}
								</button>
							</form>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</Card>

	<!-- Offer: above everything else it competes with, because a response
       deadline is the most time-critical thing this page can carry. -->
	{#if hasOfferContent(app.offer_terms)}
		<OfferCard offer={app.offer_terms} {activityHref} extractedAt={app.context_summary_at} />
	{/if}

	<ActivitySummaryCard
		summary={app.context_summary}
		updatedAt={app.context_summary_at}
		entryCount={summarisedEntryCount}
		{activityHref}
	/>

	<DetailsCard
		details={app.context_details ?? []}
		updatedAt={app.context_summary_at}
		{activityHref}
	/>

	<!-- Job Details -->
	<Card padding="lg">
		{#if job}
			<!-- Tags -->
			{#if job.job_types || job.work_location || job.experience_levels}
				<div class="mb-3 flex flex-wrap gap-2">
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
			{/if}

			<!-- Details -->
			<div class="flex flex-col gap-2 text-sm">
				{#if job.company}
					<div class="flex items-center gap-1.5">
						<FontAwesomeIcon icon={faBuilding} class="h-3.5 w-3.5 text-[var(--dash-text-muted)]" />
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
							{formatSalaryRange(
								job.salary_min,
								job.salary_max,
								job.salary_currency,
								job.salary_period
							)}
						</span>
					</div>
				{/if}
				<div class="flex items-center gap-1.5">
					<FontAwesomeIcon icon={faCalendar} class="h-3.5 w-3.5 text-[var(--dash-text-muted)]" />
					<span class="text-[var(--dash-text-muted)]">Posted</span>
					<span class="text-[var(--dash-text)]">{timeAgo(job.date_posted || job.date_created)}</span
					>
					<span class="text-[var(--dash-text-muted)]/50"
						>{formatDate(job.date_posted || job.date_created)}</span
					>
				</div>
				{#if job.job_platform}
					<div class="flex items-center gap-1.5">
						<FontAwesomeIcon icon={faGlobe} class="h-3.5 w-3.5 text-[var(--dash-text-muted)]" />
						<span class="text-[var(--dash-text-muted)]">Platform</span>
						<span class="text-[var(--dash-text)]">{job.job_platform.name}</span>
					</div>
				{:else if job.created_manually}
					<div class="flex items-center gap-1.5">
						<FontAwesomeIcon icon={faGlobe} class="h-3.5 w-3.5 text-[var(--dash-text-muted)]" />
						<span class="text-[var(--dash-text-muted)]">Source</span>
						<span class="text-[var(--dash-text)]">Added manually</span>
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
			</div>

			<!-- View Job link (footer) -->
			{#if job.id}
				<div
					class="-mx-6 mt-4 -mb-6 flex items-center border-t border-[var(--dash-border)] px-6 py-3"
				>
					<a
						href="/jobs/{job.id}"
						class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-primary)] hover:underline"
					>
						View Job Details
						<FontAwesomeIcon icon={faArrowRight} class="h-3 w-3" />
					</a>
				</div>
			{/if}
		{:else}
			<p class="text-sm text-[var(--dash-text-muted)]">No job linked to this application.</p>
		{/if}
	</Card>

	<!-- Application Details (Texts, Documents, Salary) -->
	<Card padding="lg">
		<div class="space-y-4">
			<div class="mb-4 flex items-center gap-2">
				<FontAwesomeIcon icon={faWrench} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
				<h2 class="text-sm font-semibold tracking-wide text-[var(--dash-text)] uppercase">
					Workbench
				</h2>
			</div>

			<div class="flex flex-col gap-3 text-sm">
				<!-- CV/Resume Sent -->
				{#if app.cv_sent_through}
					{@const dt = app.cv_sent_through as DocType}
					<div class="flex items-center gap-1.5">
						<FontAwesomeIcon icon={faFileAlt} class="h-3.5 w-3.5 text-[var(--dash-text-muted)]" />
						<span class="text-[var(--dash-text-secondary)]"
							>{dt === 'cv' ? 'CV' : 'Resume'} sent</span
						>
						<span class="font-medium text-[var(--dash-text)]">
							{data.cvVersionName || (dt === 'cv' ? 'CV' : 'Resume')}
						</span>
						{#if app.cv_version_sent && profileSlug}
							<a
								href={profileDocUrl({ profileSlug, docType: dt, versionSlug: app.cv_version_sent })}
								target="_blank"
								rel="noopener"
								class="text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-primary)]"
							>
								<FontAwesomeIcon icon={faExternalLinkAlt} class="h-3 w-3" />
							</a>
						{/if}
					</div>
				{/if}

				<!-- Letters -->
				{#each app.application_letters || [] as letter}
					<div class="flex items-center gap-1.5">
						<FontAwesomeIcon icon={faEnvelope} class="h-3.5 w-3.5 text-[var(--dash-text-muted)]" />
						<a
							href="/applications/{app.id}/texts/{letter.id}"
							class="font-medium text-[var(--dash-text)] transition-colors hover:text-[var(--dash-primary)]"
						>
							{letterTypeLabels[letter.letter_type] || letter.letter_type}
						</a>
						<span class="text-[var(--dash-text-muted)]">({letter.status})</span>
					</div>
				{/each}

				<!-- Questions -->
				{#if questionCount > 0}
					<div class="flex items-center justify-between">
						<span class="flex items-center gap-1.5 text-[var(--dash-text-secondary)]">
							<FontAwesomeIcon
								icon={faClipboardList}
								class="h-3.5 w-3.5 text-[var(--dash-text-muted)]"
							/>
							Application Questions
						</span>
						<a
							href="/applications/{app.id}/texts"
							class="font-medium text-[var(--dash-text)] transition-colors hover:text-[var(--dash-primary)]"
						>
							{questionCount}
						</a>
					</div>
				{/if}

				<!-- Documents -->
				{#if fileCount > 0}
					<div class="flex items-center justify-between">
						<span class="flex items-center gap-1.5 text-[var(--dash-text-secondary)]">
							<FontAwesomeIcon icon={faFileAlt} class="h-3.5 w-3.5 text-[var(--dash-text-muted)]" />
							Documents
						</span>
						<a
							href="/applications/{app.id}/activity"
							class="font-medium text-[var(--dash-text)] transition-colors hover:text-[var(--dash-primary)]"
						>
							{fileCount} attached
						</a>
					</div>
				{/if}

				<!-- Salary Expectation -->
				{#if app.salary_expectation}
					<div class="flex items-center gap-1.5">
						<FontAwesomeIcon
							icon={faMoneyBillWave}
							class="h-3.5 w-3.5 text-[var(--dash-text-muted)]"
						/>
						<span class="text-[var(--dash-text-secondary)]">Salary Expectation</span>
						<a
							href="/applications/{app.id}/salary"
							class="font-medium text-[var(--dash-text)] transition-colors hover:text-[var(--dash-primary)]"
						>
							{formatCurrency(app.salary_expectation, app.salary_currency, app.salary_period)}
						</a>
					</div>
				{/if}

				<!-- No items -->
				{#if !app.cv_sent_through && letterCount === 0 && questionCount === 0 && fileCount === 0 && !app.salary_expectation}
					<p class="text-sm text-[var(--dash-text-muted)]">No items added yet.</p>
				{/if}
			</div>

			<!-- Footer links -->
			<div
				class="-mx-6 mt-2 -mb-6 flex flex-wrap items-center gap-4 border-t border-[var(--dash-border)] px-6 py-3"
			>
				<a
					href="/applications/{app.id}/texts"
					class="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-[var(--dash-primary)] hover:underline"
				>
					Write texts <FontAwesomeIcon icon={faArrowRight} class="h-3 w-3" />
				</a>
				<a
					href="/applications/{app.id}/activity"
					class="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-[var(--dash-primary)] hover:underline"
				>
					{fileCount === 0 ? 'Log activity' : 'Open activity'}
					<FontAwesomeIcon icon={faArrowRight} class="h-3 w-3" />
				</a>
				{#if !app.salary_expectation}
					<a
						href="/applications/{app.id}/salary"
						class="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-[var(--dash-primary)] hover:underline"
					>
						Set salary <FontAwesomeIcon icon={faArrowRight} class="h-3 w-3" />
					</a>
				{/if}
			</div>
		</div>
	</Card>

	<CvSentCard
		{app}
		versions={data.versions ?? []}
		hiddenRequiredSkills={data.hiddenRequiredSkills ?? {}}
		{profileSlug}
	/>

	<!-- Notes -->
	<Card padding="lg">
		<div class="space-y-3">
			<div class="flex items-center gap-2">
				<FontAwesomeIcon icon={faStickyNote} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
				<h2 class="flex-1 text-sm font-semibold tracking-wide text-[var(--dash-text)] uppercase">
					Notes
				</h2>
				{#if !addingNote}
					<button
						type="button"
						onclick={() => {
							addingNote = true;
							tick().then(() => newNoteInput?.focus());
						}}
						class="rounded-md border border-[var(--dash-border)] px-2.5 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)]"
					>
						+ Add
					</button>
				{/if}
			</div>

			<!-- Add note input -->
			{#if addingNote}
				<form
					method="POST"
					action="?/addNote"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
							newNoteText = '';
							addingNote = false;
						};
					}}
				>
					<div class="flex items-start gap-2">
						<textarea
							name="text"
							bind:this={newNoteInput}
							bind:value={newNoteText}
							oninput={(e) => {
								const el = e.currentTarget;
								el.style.height = 'auto';
								el.style.height = el.scrollHeight + 'px';
							}}
							onkeydown={(e) => {
								if (e.key === 'Escape') {
									addingNote = false;
									newNoteText = '';
								} else if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									if (newNoteText.trim()) e.currentTarget.form?.requestSubmit();
								}
							}}
							placeholder="Add a note..."
							rows={1}
							class="flex-1 resize-none overflow-hidden rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-sm text-[var(--dash-text)] focus:border-[var(--dash-primary)] focus:outline-none"
						></textarea>
						<button
							type="submit"
							disabled={!newNoteText.trim()}
							class="p-2 text-[var(--dash-primary)] transition-colors hover:text-[var(--dash-primary-hover)] disabled:opacity-30"
						>
							<FontAwesomeIcon icon={faPlus} class="h-4 w-4" />
						</button>
					</div>
				</form>
			{/if}

			<!-- Note list -->
			{#if notes.length > 0}
				<ul class="mt-2 space-y-0.5">
					{#each notes as note (note.id)}
						<li
							class="group -mx-2 flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--dash-bg)]"
						>
							{#if editingNoteId === note.id}
								<!-- Editing mode -->
								<form
									method="POST"
									action="?/updateNote"
									class="flex flex-1 items-start gap-2"
									use:enhance={() => {
										return async ({ update }) => {
											await update();
											editingNoteId = null;
										};
									}}
								>
									<input type="hidden" name="note_id" value={note.id} />
									<textarea
										name="text"
										bind:value={editingNoteText}
										oninput={(e) => {
											const el = e.currentTarget;
											el.style.height = 'auto';
											el.style.height = el.scrollHeight + 'px';
										}}
										onkeydown={(e) => {
											if (e.key === 'Escape') editingNoteId = null;
											else if (e.key === 'Enter' && !e.shiftKey) {
												e.preventDefault();
												if (editingNoteText.trim()) e.currentTarget.form?.requestSubmit();
											}
										}}
										use:autoResizeOnMount
										rows={1}
										class="flex-1 resize-none overflow-hidden rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)] focus:border-[var(--dash-primary)] focus:outline-none"
									></textarea>
									<button
										type="submit"
										class="p-1 text-[var(--dash-primary)] transition-colors hover:text-[var(--dash-primary-hover)]"
									>
										<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
									</button>
									<button
										type="button"
										onclick={() => (editingNoteId = null)}
										class="p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)]"
									>
										<FontAwesomeIcon icon={faTimes} class="h-3 w-3" />
									</button>
								</form>
							{:else}
								<!-- View mode -->
								<div class="min-w-0 flex-1 border-l-2 border-[var(--dash-border)] pl-3">
									<span class="text-sm leading-relaxed whitespace-pre-wrap text-white"
										>{@html linkify(note.text)}</span
									>
									<span class="ml-2 text-xs text-[var(--dash-text-muted)]"
										>{timeAgo(note.created_at)}</span
									>
								</div>
								<div
									class="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
								>
									<button
										type="button"
										onclick={() => {
											editingNoteId = note.id;
											editingNoteText = note.text;
										}}
										class="p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-primary)]"
									>
										<FontAwesomeIcon icon={faPencil} class="h-3 w-3" />
									</button>
									{#if confirmingDeleteId === note.id}
										<form
											method="POST"
											action="?/deleteNote"
											class="flex items-center gap-1"
											use:enhance={() => {
												return async ({ update }) => {
													await update();
													confirmingDeleteId = null;
												};
											}}
										>
											<input type="hidden" name="note_id" value={note.id} />
											<button
												type="submit"
												class="px-1 py-0.5 text-xs font-medium text-[var(--dash-error)]"
											>
												Delete?
											</button>
										</form>
										<button
											type="button"
											onclick={() => (confirmingDeleteId = null)}
											class="p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)]"
										>
											<FontAwesomeIcon icon={faTimes} class="h-3 w-3" />
										</button>
									{:else}
										<button
											type="button"
											onclick={() => (confirmingDeleteId = note.id)}
											class="p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-error)]"
										>
											<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
										</button>
									{/if}
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</Card>

	<!-- Discontinued Info -->
	{#if app.discontinued_reason}
		<Card padding="lg">
			<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
				<p class="text-sm font-medium text-[var(--dash-error)]">
					Discontinued: {app.discontinued_reason}
				</p>
				{#if app.discontinued_note}
					<p class="mt-1 text-sm text-[var(--dash-error)]">
						{app.discontinued_note}
					</p>
				{/if}
			</div>
		</Card>
	{/if}

	<!-- Recent Activity -->
	<Card padding="lg">
		<div class="space-y-3">
			<div class="mb-4 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<FontAwesomeIcon icon={faCalendar} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
					<h2 class="text-sm font-semibold tracking-wide text-[var(--dash-text)] uppercase">
						Recent Activity
					</h2>
				</div>
				{#if statusLogCount > 5}
					<a
						href="/applications/{app.id}/activity"
						class="flex items-center gap-1.5 text-xs text-[var(--dash-primary)] hover:underline"
					>
						View all ({statusLogCount})
						<FontAwesomeIcon icon={faArrowRight} class="h-3 w-3" />
					</a>
				{/if}
			</div>

			{#if recentStatusLog.length > 0}
				<div class="relative">
					<div class="absolute top-0 bottom-0 left-[13px] w-0.5 bg-[var(--dash-border)]"></div>
					<div class="space-y-0">
						{#each recentStatusLog as entry}
							<div class="relative flex gap-3.5 pb-4">
								<div class="relative z-10 flex w-7 flex-shrink-0 justify-center">
									<div
										class="h-3.5 w-3.5 rounded-full {getStatusBgColor(
											entry.to_status
										)} mt-0.5 border-2 border-[var(--dash-card)]"
									></div>
								</div>
								<div class="-mt-0.5 min-w-0 flex-1 space-y-0.5">
									{#if entry.from_status !== entry.to_status}
										<div class="mb-1.5">
											<span
												class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(
													entry.to_status
												)}"
											>
												{getStatusLabel(entry.to_status)}
											</span>
										</div>
									{/if}
									{#if entry.step}
										<p class="text-xs text-[var(--dash-text-secondary)] italic">{entry.step}</p>
									{/if}
									{#if entry.action}
										<p class="text-xs font-medium text-[var(--dash-primary)]">
											→ {entry.action}
											{#if entry.action_date}
												— {formatDate(entry.action_date)}
											{/if}
										</p>
									{/if}
									{#if entry.description}
										<p class="text-xs text-[var(--dash-text)]">{entry.description}</p>
									{/if}
									{#if entry.date_created}
										<p class="mt-0.5 flex items-center gap-1 text-xs text-[var(--dash-text-muted)]">
											<FontAwesomeIcon icon={faCalendar} class="h-2.5 w-2.5" />
											{formatDate(entry.date_created)}
										</p>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<p class="text-sm text-[var(--dash-text-muted)]">
					No activity recorded yet. Activity will be logged when you change the application status.
				</p>
			{/if}

			{#if statusLogCount <= 5 && statusLogCount > 0}
				<a
					href="/applications/{app.id}/activity"
					class="flex items-center gap-1.5 pt-2 text-xs text-[var(--dash-primary)] hover:underline"
				>
					View full timeline
					<FontAwesomeIcon icon={faArrowRight} class="h-3 w-3" />
				</a>
			{/if}
		</div>
	</Card>

	<!-- More (collapsible) -->
	<div>
		<button
			type="button"
			onclick={() => (showMore = !showMore)}
			class="flex items-center gap-2 text-sm text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)]"
		>
			<FontAwesomeIcon
				icon={faChevronDown}
				class="h-3 w-3 transition-transform {showMore ? 'rotate-180' : ''}"
			/>
			More
		</button>
		{#if showMore}
			<div class="mt-4">
				<button
					type="button"
					onclick={() => (showDeleteConfirm = true)}
					class="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-500 transition-colors hover:border-red-500/50 hover:bg-red-500/20"
				>
					<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
					Delete Application
				</button>
			</div>
		{/if}
	</div>
</div>

<ConfirmModal
	isOpen={showDeleteConfirm}
	title="Delete Application"
	message="Are you sure you want to permanently delete this application? All texts, documents, and timeline history will be removed. This action cannot be undone."
	confirmLabel="Delete"
	onCancel={() => (showDeleteConfirm = false)}
	onConfirm={() => {
		showDeleteConfirm = false;
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/delete';
		document.body.appendChild(form);
		form.submit();
	}}
/>

<!-- Status Picker Modal -->
{#if statusPickerOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		use:portalToBody={{ onClose: () => (statusPickerOpen = false) }}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		role="dialog"
		onclick={(e) => {
			if (e.target === e.currentTarget) statusPickerOpen = false;
		}}
	>
		<div class="w-full max-w-lg rounded-xl bg-[var(--dash-card)] p-6 shadow-lg">
			<h3 class="mb-4 text-lg font-semibold text-[var(--dash-text)]">Update Status</h3>

			{#key app.status + (app.status_step || '') + (app.status_action || '')}
				<StatusStepper
					status={app.status}
					statusStep={app.status_step}
					statusAction={app.status_action}
					statusActionDate={app.status_action_date
						? new Date(app.status_action_date).toISOString().split('T')[0]
						: null}
					bind:saving={statusSaving}
					oncancel={() => (statusPickerOpen = false)}
					onsave={() => (statusPickerOpen = false)}
				/>
			{/key}
		</div>
	</div>
{/if}
