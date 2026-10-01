<script lang="ts">
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowRight,
		faBuilding,
		faCalendar,
		faChevronDown,
		faClipboardList,
		faExternalLinkAlt,
		faCalendarCheck,
		faClock,
		faGlobe,
		faHandPointRight,
		faMapMarkerAlt,
		faMugHot,
		faPencil,
		faPlay,
		faMoneyBillWave,
		faTrash
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
	import ActivitySummaryCard from './ActivitySummaryCard.svelte';
	import OfferCard from './OfferCard.svelte';
	import KeyFactsCard from './KeyFactsCard.svelte';
	import { hasOfferContent } from '$lib/application-offer';
	import { describeSnooze, isSnoozed, snoozePresets, snoozeUntil } from '$lib/application-snooze';
	import { formatSalaryRange, timeAgo } from '$lib/format';
	import { formatDate as fmtDate } from '$lib/format-date';
	import { portalToBody } from '$lib/actions/portal';
	// The first use of Kit's typed route resolution in this codebase. Every other
	// internal link here is a template string and sits in the lint baseline; new
	// ones may as well be checked at build time, which is what the rule wants.
	import { resolve } from '$app/paths';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let app = $derived(data.application);
	let job = $derived(app.job);

	// Status widget
	let statusPickerOpen = $state(false);
	let statusSaving = $state(false);
	let quickSaving = $state(false);
	let quickActions = $derived(getQuickStatusActions(app.status, app.status_step));

	// Snooze. Beside the status rather than inside it: pausing your own work on
	// an application says nothing about where the employer has got to.
	let snoozed = $derived(isSnoozed(app, data.today));
	let snoozeOpen = $state(false);
	let snoozeSaving = $state(false);
	let customUntil = $state('');
	let snoozeReason = $state('');

	function closeSnooze() {
		snoozeOpen = false;
		customUntil = '';
		snoozeReason = '';
	}

	const snoozeSubmit = () => {
		snoozeSaving = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			snoozeSaving = false;
			closeSnooze();
		};
	};

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

	// What the summariser decides from: the length of each entry's text, 0 for
	// an extraction with nothing in it. Computed in the layout query rather than
	// from the text, which this page no longer receives.
	let entryLengths = $derived((app.application_records ?? []).map((r) => r.content_length ?? 0));
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
	<div>
		<h2 class="text-2xl font-bold text-[var(--dash-text)]">
			{job?.title || 'Untitled Position'}
		</h2>
		{#if job?.company}
			<p class="mt-1 flex items-center gap-1.5 text-base text-[var(--dash-text-secondary)]">
				<FontAwesomeIcon icon={faBuilding} class="h-3.5 w-3.5 text-[var(--dash-text-muted)]" />
				{job.company}
			</p>
		{/if}
	</div>

	<!-- Status and the job it is for, side by side when there is room. Both are
	     short and each filled under half of a full-width row, and the job used
	     to sit under Key facts, which grows with every entry, so its link out
	     had drifted a couple of screens down. Not paired without a job: that
	     would be a half-width card holding one line. -->
	<div class="grid grid-cols-1 gap-6 {job ? 'md:grid-cols-2' : ''}">
		<!-- Status Widget (top of page) -->
		<Card padding="lg">
			<div class="space-y-3">
				<div class="mb-2 flex items-center gap-2">
					<FontAwesomeIcon
						icon={faClipboardList}
						class="h-4 w-4 text-[var(--dash-text-secondary)]"
					/>
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
						<p
							class="text-sm font-semibold tracking-wide uppercase {getStatusDotColor(app.status)}"
						>
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

				<!-- Snooze: parking your own work on this, which is a different axis from
				     the status above and so does not touch it. -->
				<div class="border-t border-[var(--dash-border)] pt-3">
					{#if snoozed && app.snoozed_until}
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div class="min-w-0">
								<p
									class="flex items-center gap-1.5 text-sm font-medium text-[var(--dash-text-secondary)]"
								>
									<FontAwesomeIcon icon={faMugHot} class="h-3.5 w-3.5" />
									Snoozed until {formatDate(app.snoozed_until)} — {describeSnooze(
										app.snoozed_until,
										data.today
									)}
								</p>
								{#if app.snooze_reason}
									<p class="mt-0.5 text-xs text-[var(--dash-text-muted)] italic">
										{app.snooze_reason}
									</p>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<form method="POST" action="?/updateSnooze" use:enhance={snoozeSubmit}>
									<input type="hidden" name="until" value="" />
									<button
										type="submit"
										disabled={snoozeSaving}
										class="flex items-center gap-1.5 rounded-lg border border-[var(--dash-primary)] px-3 py-1.5 text-sm font-medium text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-primary)]/10 disabled:opacity-50"
									>
										<FontAwesomeIcon icon={faPlay} class="h-3 w-3" />
										Resume now
									</button>
								</form>
								<button
									type="button"
									onclick={() => (snoozeOpen = !snoozeOpen)}
									class="text-xs text-[var(--dash-text-muted)] underline-offset-2 hover:underline"
								>
									Change
								</button>
							</div>
						</div>
					{:else}
						<button
							type="button"
							onclick={() => (snoozeOpen = !snoozeOpen)}
							class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)]"
						>
							<FontAwesomeIcon icon={faMugHot} class="h-3 w-3" />
							Snooze this application
						</button>
					{/if}

					{#if snoozeOpen}
						<form
							method="POST"
							action="?/updateSnooze"
							use:enhance={snoozeSubmit}
							class="mt-3 space-y-3 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] p-3"
						>
							<div class="flex flex-wrap gap-2">
								{#each snoozePresets as preset (preset.value)}
									<button
										type="button"
										onclick={() => (customUntil = snoozeUntil(preset.days, data.today))}
										class="rounded-lg border px-3 py-1.5 text-sm transition-colors {customUntil ===
										snoozeUntil(preset.days, data.today)
											? 'border-[var(--dash-primary)] text-[var(--dash-primary)]'
											: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
									>
										{preset.label}
									</button>
								{/each}
							</div>

							<div class="flex flex-wrap items-end gap-3">
								<label class="flex flex-col gap-1 text-xs text-[var(--dash-text-muted)]">
									Comes back on
									<input
										type="date"
										name="until"
										bind:value={customUntil}
										min={snoozeUntil(1, data.today)}
										required
										class="rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-2 py-1.5 text-sm text-[var(--dash-text)]"
									/>
								</label>
								<label
									class="flex min-w-[180px] flex-1 flex-col gap-1 text-xs text-[var(--dash-text-muted)]"
								>
									Why (optional)
									<input
										type="text"
										name="reason"
										bind:value={snoozeReason}
										maxlength="255"
										placeholder="Too many in flight right now"
										class="rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-2 py-1.5 text-sm text-[var(--dash-text)]"
									/>
								</label>
							</div>

							<div class="flex items-center gap-2">
								<button
									type="submit"
									disabled={snoozeSaving || !customUntil}
									class="rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
								>
									{snoozed ? 'Update snooze' : 'Snooze'}
								</button>
								<button
									type="button"
									onclick={closeSnooze}
									class="px-2 py-1.5 text-sm text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)]"
								>
									Cancel
								</button>
							</div>
						</form>
					{/if}
				</div>
			</div>
		</Card>

		<!-- Job Details. A column whose details grow, so the footer stays at the
		     bottom when the row stretches this card to the status card's height. -->
		<Card padding="lg" class="flex flex-col">
			{#if job}
				<!-- Tags -->
				{#if job.job_types || job.work_location || job.experience_levels}
					<div class="mb-3 flex flex-wrap gap-2">
						{#if job.job_types && Array.isArray(job.job_types)}
							{#each job.job_types as type, i (i)}
								<CategoryPill category="job_type" value={type} />
							{/each}
						{/if}
						{#if job.work_location && Array.isArray(job.work_location)}
							{#each job.work_location as loc, i (i)}
								<CategoryPill category="work_location" value={loc} />
							{/each}
						{/if}
						{#if job.experience_levels && Array.isArray(job.experience_levels)}
							{#each job.experience_levels as level, i (i)}
								<CategoryPill category="experience_level" value={level} />
							{/each}
						{/if}
					</div>
				{/if}

				<!-- Details -->
				<div class="flex grow flex-col gap-2 text-sm">
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
						<span class="text-[var(--dash-text)]"
							>{timeAgo(job.date_posted || job.date_created)}</span
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
							<ExternalLink
								href={job.source_url}
								target="_blank"
								rel="noopener"
								class="truncate text-[var(--dash-primary)] transition-colors hover:text-[var(--dash-primary-hover)]"
							>
								{job.source_url.replace(/^https?:\/\/(?:www\.)?/, '')}
							</ExternalLink>
						</div>
					{/if}
				</div>

				<!-- View Job link (footer) -->
				{#if job.id}
					<div
						class="-mx-6 mt-4 -mb-6 flex items-center border-t border-[var(--dash-border)] px-6 py-3"
					>
						<a
							href={resolve('/(app)/jobs/[id]', { id: String(job.id) })}
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
	</div>

	<!-- Offer: above everything else it competes with, because a response
       deadline is the most time-critical thing this page can carry. -->
	{#if hasOfferContent(app.offer_terms)}
		<OfferCard offer={app.offer_terms} {activityHref} extractedAt={app.context_summary_at} />
	{/if}

	<ActivitySummaryCard
		summary={app.context_summary}
		updatedAt={app.context_summary_at}
		{entryLengths}
		{activityHref}
	/>

	<KeyFactsCard
		details={app.context_details ?? []}
		updatedAt={app.context_summary_at}
		{entryLengths}
		{activityHref}
	/>

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
						href={resolve('/(app)/applications/[id]/activity', { id: String(app.id) })}
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
						{#each recentStatusLog as entry, i (i)}
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
					href={resolve('/(app)/applications/[id]/activity', { id: String(app.id) })}
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
	<!-- Backdrop: a click outside the card closes, as Escape does. -->
	<button
		type="button"
		use:portalToBody
		class="fixed inset-0 z-40 bg-black/50"
		onclick={() => (statusPickerOpen = false)}
		tabindex="-1"
		aria-label="Close status picker"
	></button>
	<div
		use:portalToBody={{ onClose: () => (statusPickerOpen = false) }}
		class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="status-picker-title"
	>
		<div class="pointer-events-auto w-full max-w-lg rounded-xl bg-[var(--dash-card)] p-6 shadow-lg">
			<h3 id="status-picker-title" class="mb-4 text-lg font-semibold text-[var(--dash-text)]">
				Update Status
			</h3>

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
