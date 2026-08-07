<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck } from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { ResumeData } from '$lib/server/resume/types';
	import BasicsSection from './sections/BasicsSection.svelte';
	import WorkSection from './sections/WorkSection.svelte';
	import EducationSection from './sections/EducationSection.svelte';
	import SkillsSection from './sections/SkillsSection.svelte';
	import LanguagesSection from './sections/LanguagesSection.svelte';
	import ProjectsSection from './sections/ProjectsSection.svelte';
	import ReferencesSection from './sections/ReferencesSection.svelte';
	import Card from '../../../components/Card.svelte';

	interface Props {
		parsedData: ResumeData;
		fileId: string | null;
		fileName: string | null;
		source?: 'upload' | 'import' | 'manual';
		isLoading: boolean;
		error: string | null;
		onBack: () => void;
		onLoadingChange: (loading: boolean) => void;
	}

	let {
		parsedData,
		fileId,
		fileName,
		source = 'upload',
		isLoading,
		error,
		onBack,
		onLoadingChange
	}: Props = $props();

	// Editable copy of the parsed data
	const snapshot = $state.snapshot(parsedData) as ResumeData;
	let editableData = $state({
		basics: snapshot.basics,
		work: snapshot.work ?? [],
		education: snapshot.education ?? [],
		skills: snapshot.skills ?? [],
		languages: snapshot.languages ?? [],
		projects: snapshot.projects ?? [],
		references: snapshot.references ?? []
	});

	// Stats for display
	let stats = $derived({
		work: editableData.work.length,
		education: editableData.education.length,
		skills: editableData.skills.reduce((sum, cat) => sum + cat.skills.length, 0),
		languages: editableData.languages.length,
		projects: editableData.projects.length,
		references: editableData.references.length
	});

	// Validation
	let isValid = $derived(editableData.basics?.name?.trim().length > 0);
</script>

<div class="space-y-4">
	<Card padding="responsive">
		<div
			class="rounded-lg border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/10 px-4 py-3"
		>
			<p class="text-sm text-[var(--dash-text)]">
				{#if source === 'manual'}
					Fill in your information to get started. You can add more details later.
				{:else if source === 'import'}
					Your profile has not been created yet. Review the imported data below, make any edits,
					then click <strong>Create Profile</strong>.
				{:else if fileName}
					Your profile has not been created yet. We extracted data from
					<span class="font-medium">{fileName}</span> — review and edit, then click
					<strong>Create Profile</strong>.
				{:else}
					Your profile has not been created yet. Review the extracted data below, make any edits,
					then click <strong>Create Profile</strong>.
				{/if}
			</p>
		</div>

		<!-- Stats summary -->
		{#if source !== 'manual'}
			<div
				class="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-[var(--dash-bg)] p-3 sm:p-4 md:grid-cols-6"
			>
				<div class="text-center">
					<div class="text-lg font-semibold text-[var(--dash-primary)] sm:text-xl">
						{stats.work}
					</div>
					<div class="text-[10px] text-[var(--dash-text-muted)] sm:text-xs">Jobs</div>
				</div>
				<div class="text-center">
					<div class="text-lg font-semibold text-[var(--dash-primary)] sm:text-xl">
						{stats.education}
					</div>
					<div class="text-[10px] text-[var(--dash-text-muted)] sm:text-xs">Education</div>
				</div>
				<div class="text-center">
					<div class="text-lg font-semibold text-[var(--dash-primary)] sm:text-xl">
						{stats.skills}
					</div>
					<div class="text-[10px] text-[var(--dash-text-muted)] sm:text-xs">Skills</div>
				</div>
				<div class="text-center">
					<div class="text-lg font-semibold text-[var(--dash-primary)] sm:text-xl">
						{stats.languages}
					</div>
					<div class="text-[10px] text-[var(--dash-text-muted)] sm:text-xs">Languages</div>
				</div>
				<div class="text-center">
					<div class="text-lg font-semibold text-[var(--dash-primary)] sm:text-xl">
						{stats.projects}
					</div>
					<div class="text-[10px] text-[var(--dash-text-muted)] sm:text-xs">Projects</div>
				</div>
				<div class="text-center">
					<div class="text-lg font-semibold text-[var(--dash-primary)] sm:text-xl">
						{stats.references}
					</div>
					<div class="text-[10px] text-[var(--dash-text-muted)] sm:text-xs">References</div>
				</div>
			</div>
		{/if}
	</Card>

	{#if error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{error}</p>
		</div>
	{/if}

	<!-- Editable sections -->
	<BasicsSection bind:basics={editableData.basics} />
	<WorkSection bind:work={editableData.work} />
	<EducationSection bind:education={editableData.education} />
	<SkillsSection bind:skills={editableData.skills} />
	<LanguagesSection bind:languages={editableData.languages} />
	<ProjectsSection bind:projects={editableData.projects} />
	<ReferencesSection bind:references={editableData.references} />

	<!-- Submit form -->
	<form
		method="POST"
		action="?/create"
		use:enhance={({ formData }) => {
			formData.set('data', JSON.stringify($state.snapshot(editableData)));
			onLoadingChange(true);
			return async ({ result, update }) => {
				onLoadingChange(false);
				if (result.type === 'redirect') {
					await goto(result.location, { invalidateAll: true });
				} else {
					await update();
				}
			};
		}}
		class="sticky bottom-0 z-10 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] sm:p-6"
	>
		<input type="hidden" name="data" value="" />
		{#if fileId}
			<input type="hidden" name="fileId" value={fileId} />
		{/if}

		{#if !isValid}
			<div
				class="mb-4 rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4"
			>
				<p class="text-sm text-[var(--dash-error)]">Please enter a name to continue.</p>
			</div>
		{/if}

		<div class="flex justify-end gap-2">
			<button
				type="button"
				onclick={onBack}
				class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
			>
				Back
			</button>

			<button
				type="submit"
				disabled={!isValid || isLoading}
				class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isLoading}
					<Spinner size="w-4 h-4" />
					Creating Profile...
				{:else}
					<FontAwesomeIcon icon={faCheck} class="h-4 w-4" />
					Create Profile
				{/if}
			</button>
		</div>
	</form>
</div>
