<script lang="ts">
	import type { PageData } from './$types';
	import { armOn } from '$lib/actions/arm-on';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faArrowLeft, faGraduationCap, faTrash } from '@fortawesome/free-solid-svg-icons';
	import MediaUpload from '$lib/components/MediaUpload.svelte';
	import { autoSaveField, patchBody, recordsEqual } from '$lib/components/auto-save.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import TranslatableField from '$lib/components/TranslatableField.svelte';
	import VersionTags from '$lib/components/VersionTags.svelte';
	import ConfirmModal from '../../../components/ConfirmModal.svelte';
	import Card from '../../../../components/Card.svelte';

	let { data }: { data: PageData } = $props();

	let logoUrl = $state(data.logoUrl);
	let bannerUrl = $state(data.bannerUrl);

	let education = $derived(data.education);

	let pageTitle = $derived(education.institution || 'Education');

	// Form states
	let editInstitution = $state(education.institution || '');
	let editArea = $state(education.area || '');
	let editStudyType = $state(education.study_type || '');
	let editLocation = $state(education.location || '');
	let editUrl = $state(education.url || '');
	let editGraduationYear = $state(education.graduation_year?.toString() || '');
	let editStartDate = $state(formatDate(education.start_date));
	let editEndDate = $state(formatDate(education.end_date));
	let editSummary = $state(education.summary || '');
	let editTags = $state<string[]>(
		Array.isArray(education.tags) ? (education.tags as string[]) : []
	);
	let showDeleteConfirm = $state(false);

	function formatDate(date: Date | string | null): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toISOString().split('T')[0];
	}

	// The whole card is one PATCH, so it's one auto-saved field with one undo
	// window — same shape as the other profile detail pages.
	type EducationBasics = {
		institution: string;
		area: string;
		studyType: string;
		location: string;
		url: string;
		graduationYear: string;
		startDate: string;
		endDate: string;
		summary: string;
	};
	/** Form state as the API expects it. Both sides of the diff go through here. */
	function basicsBody(v: EducationBasics) {
		return {
			institution: v.institution,
			area: v.area,
			study_type: v.studyType,
			location: v.location,
			url: v.url,
			graduation_year: v.graduationYear || null,
			start_date: v.startDate || null,
			end_date: v.endDate || null,
			summary: v.summary
		};
	}
	const basicsField = autoSaveField<EducationBasics>({
		armOnInteraction: true,
		initial: {
			institution: editInstitution,
			area: editArea,
			studyType: editStudyType,
			location: editLocation,
			url: editUrl,
			graduationYear: editGraduationYear,
			startDate: editStartDate,
			endDate: editEndDate,
			summary: editSummary
		},
		save: async (v, prev) => {
			const body = patchBody(basicsBody(v), basicsBody(prev));
			if (!body) return;

			const response = await fetch(`/api/education/${education.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!response.ok) {
				const failed = await response.json().catch(() => ({}));
				throw new Error(failed.message || failed.error || `Save failed (${response.status})`);
			}
		},
		onSaved: (v) => {
			editInstitution = v.institution;
			editArea = v.area;
			editStudyType = v.studyType;
			editLocation = v.location;
			editUrl = v.url;
			editGraduationYear = v.graduationYear;
			editStartDate = v.startDate;
			editEndDate = v.endDate;
			editSummary = v.summary;
		},
		equal: recordsEqual,
		debounceMs: 700
	});
	$effect(() =>
		basicsField.set({
			institution: editInstitution,
			area: editArea,
			studyType: editStudyType,
			location: editLocation,
			url: editUrl,
			graduationYear: editGraduationYear,
			startDate: editStartDate,
			endDate: editEndDate,
			summary: editSummary
		})
	);
</script>

<svelte:head>
	<title>{pageTitle} - Education - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6" use:armOn={basicsField.arm}>
	<!-- Header -->
	<div class="flex items-center gap-4">
		<a
			href="/profile/education"
			class="flex items-center gap-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
		>
			<FontAwesomeIcon icon={faArrowLeft} class="h-4 w-4" />
			<span class="text-sm">All Education</span>
		</a>
	</div>

	<div class="flex items-center gap-4">
		{#if logoUrl}
			<img
				src={logoUrl}
				alt="{education.institution} logo"
				class="h-12 w-12 rounded-lg object-cover"
			/>
		{:else}
			<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dash-bg)]">
				<FontAwesomeIcon icon={faGraduationCap} class="h-6 w-6 text-[var(--dash-primary)]" />
			</div>
		{/if}
		<div>
			<h1 class="text-2xl font-bold text-[var(--dash-text)]">Edit Education</h1>
			<p class="text-[var(--dash-text-secondary)]">
				{education.institution}
				{#if education.area}
					- {education.area}{/if}
			</p>
		</div>
	</div>

	<!-- Basic Info -->
	<Card padding="lg">
		<h2 class="mb-4 text-lg font-semibold text-[var(--dash-text)]">Basic Information</h2>
		<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label
						for="edit-institution"
						class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
					>
						Institution <span class="text-[var(--dash-error)]">*</span>
					</label>
					<input
						type="text"
						id="edit-institution"
						bind:value={editInstitution}
						required
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<TranslatableField
					entity="education"
					id={education.id}
					field="area"
					label="Field of Study"
					bind:value={editArea}
				/>

				<TranslatableField
					entity="education"
					id={education.id}
					field="study_type"
					label="Degree Type"
					bind:value={editStudyType}
					placeholder="e.g., Bachelor's, Master's, PhD"
				/>

				<div>
					<label for="edit-location" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						Location
					</label>
					<input
						type="text"
						id="edit-location"
						bind:value={editLocation}
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<div>
					<label for="edit-url" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						Website URL
					</label>
					<input
						type="url"
						id="edit-url"
						bind:value={editUrl}
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<div>
					<label
						for="edit-graduation-year"
						class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
					>
						Graduation Year
					</label>
					<input
						type="number"
						id="edit-graduation-year"
						bind:value={editGraduationYear}
						min="1950"
						max="2100"
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<div>
					<label
						for="edit-start-date"
						class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
					>
						Start Date
					</label>
					<input
						type="date"
						id="edit-start-date"
						bind:value={editStartDate}
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<div>
					<label for="edit-end-date" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						End Date
					</label>
					<input
						type="date"
						id="edit-end-date"
						bind:value={editEndDate}
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>
			</div>

			<TranslatableField
				entity="education"
				id={education.id}
				field="summary"
				label="Summary"
				multiline
				rows={5}
				bind:value={editSummary}
				placeholder="Brief description of your studies, achievements, etc."
			/>
		</div>
		<div class="mt-4 flex justify-end">
			<AutoSaveIndicator field={basicsField} />
		</div>
	</Card>

	<!-- Portfolio Images -->
	<Card padding="lg">
		<h2 class="mb-2 text-lg font-semibold text-[var(--dash-text)]">Portfolio Images</h2>
		<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
			These images are used for your portfolio display. They are not required for job search or
			scoring.
		</p>
		<div class="flex gap-6">
			<div class="max-w-xs">
				<MediaUpload
					entityType="education"
					entityId={education.id}
					field="logo_path"
					currentUrl={logoUrl}
					label="Institution Logo"
					showHint={false}
					onUpload={(url) => (logoUrl = url)}
					onDelete={() => (logoUrl = null)}
				/>
			</div>
			<div class="flex-1">
				<MediaUpload
					entityType="education"
					entityId={education.id}
					field="banner_path"
					currentUrl={bannerUrl}
					label="Institution Banner"
					showHint={false}
					onUpload={(url) => (bannerUrl = url)}
					onDelete={() => (bannerUrl = null)}
				/>
			</div>
		</div>
		<p class="mt-3 text-xs text-[var(--dash-text-secondary)]">JPEG, PNG, WebP, or GIF. Max 5MB.</p>
	</Card>

	<!-- Version Tags -->
	<VersionTags bind:tags={editTags} apiUrl={`/api/education/${education.id}`} />

	<!-- Danger Zone -->
	<Card padding="lg">
		<div class="space-y-3">
			<div class="mb-2 flex items-center gap-2">
				<FontAwesomeIcon icon={faTrash} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
				<h2 class="text-sm font-semibold tracking-wide text-[var(--dash-text)] uppercase">
					Danger Zone
				</h2>
			</div>

			<p class="text-sm text-[var(--dash-text-secondary)]">
				Permanently remove this education entry and all associated data.
			</p>

			<button
				type="button"
				onclick={() => (showDeleteConfirm = true)}
				class="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-500 transition-colors hover:border-red-500/50 hover:bg-red-500/20"
			>
				<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
				Delete Education
			</button>
		</div>
	</Card>
</div>

<ConfirmModal
	isOpen={showDeleteConfirm}
	title="Delete Education"
	message="Are you sure you want to permanently delete this education entry? This action cannot be undone."
	confirmLabel="Delete"
	onCancel={() => (showDeleteConfirm = false)}
	onConfirm={() => {
		showDeleteConfirm = false;
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '/profile/education?/delete';
		const input = document.createElement('input');
		input.type = 'hidden';
		input.name = 'id';
		input.value = String(education.id);
		form.appendChild(input);
		document.body.appendChild(form);
		form.submit();
	}}
/>
