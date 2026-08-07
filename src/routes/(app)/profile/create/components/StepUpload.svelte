<script lang="ts">
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowRight,
		faCloudUploadAlt,
		faFile,
		faTimes
	} from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { ExportedProfile } from '$lib/server/profile/export-profile-json';
	import type { ResumeData } from '$lib/server/resume/types';
	import { convertExportToResumeData } from '../lib/convert-export';
	import Card from '../../../components/Card.svelte';

	interface Props {
		isLoading: boolean;
		error: string | null;
		onSkipToManual: () => void;
		onUploadComplete: (data: { parsedData: unknown; fileId: string; fileName: string }) => void;
		onImportComplete: (data: ResumeData) => void;
		onError: (error: string) => void;
		onLoadingChange: (loading: boolean) => void;
	}

	let {
		isLoading,
		error,
		onSkipToManual,
		onUploadComplete,
		onImportComplete,
		onError,
		onLoadingChange
	}: Props = $props();

	let selectedFile = $state<File | null>(null);
	let isDragging = $state(false);

	// SJS export detection
	let parsedExport = $state<ExportedProfile | null>(null);
	let exportPreview = $state<{
		name: string;
		title?: string;
		counts: { label: string; count: number }[];
	} | null>(null);
	let parseError = $state<string | null>(null);

	let isSjsExport = $derived(!!exportPreview);
	const displayError = $derived(error || parseError);

	async function detectSjsExport(file: File) {
		if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
			parsedExport = null;
			exportPreview = null;
			parseError = null;
			return;
		}

		try {
			const text = await file.text();
			const jsonData = JSON.parse(text);
			const p = jsonData?.profile;

			if (!p) {
				// Not an SJS export — will be handled by server as JSON Resume
				parsedExport = null;
				exportPreview = null;
				parseError = null;
				return;
			}

			parsedExport = jsonData as ExportedProfile;

			const counts: { label: string; count: number }[] = [];
			const add = (label: string, arr: unknown[] | undefined | null) => {
				const len = arr?.length ?? 0;
				if (len > 0) counts.push({ label, count: len });
			};

			add('Work experiences', p.work_experiences);
			add('Education', p.education);
			add('Skill categories', p.tech_skill_categories);
			add('Side projects', p.side_projects);
			add('Profile versions', p.profile_versions);
			add('Languages', p.languages);
			add('Highlights', p.highlights);
			add('References', p.references);
			add('Project stories', p.project_stories);
			add('Interview cheat sheets', p.cheat_sheets);
			if (p.salary_settings) {
				counts.push({ label: 'Salary settings', count: 1 });
			} else {
				add('Salary expectations', p.salary_expectations);
			}

			exportPreview = {
				name: p.name || 'Unnamed profile',
				title: p.title || undefined,
				counts
			};
			parseError = null;
		} catch {
			parsedExport = null;
			exportPreview = null;
			parseError = null;
		}
	}

	function setFile(file: File) {
		parseError = null;
		exportPreview = null;
		parsedExport = null;
		selectedFile = file;

		const input = document.getElementById('file-input') as HTMLInputElement;
		if (input) {
			const dt = new DataTransfer();
			dt.items.add(file);
			input.files = dt.files;
		}

		detectSjsExport(file);
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			setFile(input.files[0]);
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			setFile(files[0]);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function clearFile() {
		selectedFile = null;
		parsedExport = null;
		exportPreview = null;
		parseError = null;
	}

	function handleImportContinue() {
		if (!parsedExport) {
			onError('No valid export data found');
			return;
		}
		try {
			const resumeData = convertExportToResumeData(parsedExport);
			onImportComplete(resumeData);
		} catch {
			onError('Failed to convert export data');
		}
	}
</script>

<Card padding="responsive">
	<h3 class="mb-1 font-medium text-[var(--dash-text)]">Upload Your CV/Resume</h3>
	<p class="mb-1 text-sm text-[var(--dash-text-secondary)]">
		Upload a resume, or import from a previous export
	</p>
	<p class="mb-4 text-xs text-[var(--dash-text-muted)]">
		New here? See <a
			href="/guide/how-it-works"
			target="_blank"
			rel="noopener"
			class="text-[var(--dash-primary)] hover:underline">how Smart Job Seeker works</a
		>.
	</p>

	<form
		method="POST"
		action="?/upload"
		enctype="multipart/form-data"
		use:enhance={() => {
			onLoadingChange(true);
			return async ({ result }) => {
				onLoadingChange(false);

				if (result.type === 'success') {
					const data = result.data as {
						success?: boolean;
						parsedData?: unknown;
						fileId?: string;
						fileName?: string;
					};
					if (data?.success) {
						onUploadComplete({
							parsedData: data.parsedData,
							fileId: data.fileId as string,
							fileName: data.fileName as string
						});
					}
				} else if (result.type === 'failure') {
					const data = result.data as { error?: string } | undefined;
					onError(data?.error || 'Upload failed');
				}
			};
		}}
		class="space-y-4"
	>
		{#if displayError}
			<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
				<p class="text-sm text-[var(--dash-error)]">{displayError}</p>
			</div>
		{/if}

		<div
			role="button"
			tabindex="0"
			ondrop={handleDrop}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					document.getElementById('file-input')?.click();
				}
			}}
			class="
        relative rounded-lg border-2 border-dashed p-4 text-center transition-colors sm:p-8
        {isDragging
				? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
				: 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/50'}
      "
		>
			{#if selectedFile}
				<div class="flex items-center justify-center gap-2 sm:gap-3">
					<FontAwesomeIcon icon={faFile} class="h-6 w-6 text-[var(--dash-primary)] sm:h-8 sm:w-8" />
					<div class="text-left">
						<p class="text-sm font-medium text-[var(--dash-text)] sm:text-base">
							{selectedFile.name}
						</p>
						<p class="text-xs text-[var(--dash-text-secondary)] sm:text-sm">
							{(selectedFile.size / 1024).toFixed(1)} KB
						</p>
					</div>
					<button
						type="button"
						onclick={clearFile}
						class="rounded p-1 transition-colors hover:bg-[var(--dash-bg)]"
						aria-label="Remove file"
					>
						<FontAwesomeIcon icon={faTimes} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
					</button>
				</div>
			{:else}
				<FontAwesomeIcon
					icon={faCloudUploadAlt}
					class="mx-auto mb-3 h-12 w-12 text-[var(--dash-text-muted)] sm:mb-4 sm:h-16 sm:w-16"
				/>
				<p class="mb-1 text-sm font-medium text-[var(--dash-text)] sm:text-base">
					Drag and drop your file here, or click to browse
				</p>
				<p class="text-xs text-[var(--dash-text-secondary)] sm:text-sm">
					PDF, DOCX, JSON Resume, or SJS export (max 10MB)
				</p>
			{/if}

			<input
				id="file-input"
				type="file"
				name="file"
				accept=".pdf,.docx,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html,application/json"
				onchange={handleFileSelect}
				class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
			/>
		</div>

		{#if exportPreview}
			<div
				class="space-y-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] p-3 sm:space-y-3 sm:p-4"
			>
				<div>
					<h3 class="text-sm font-semibold text-[var(--dash-text)] sm:text-base">
						{exportPreview.name}
					</h3>
					{#if exportPreview.title}
						<p class="text-xs text-[var(--dash-text-secondary)] sm:text-sm">
							{exportPreview.title}
						</p>
					{/if}
				</div>

				{#if exportPreview.counts.length > 0}
					<div class="flex flex-wrap gap-1.5 sm:gap-2">
						{#each exportPreview.counts as { label, count }}
							<span
								class="inline-flex items-center gap-1 rounded-full border border-[var(--dash-border)] bg-[var(--dash-card)] px-2 py-0.5 text-xs font-medium text-[var(--dash-text-secondary)] sm:px-2.5 sm:py-1"
							>
								{label}
								<span
									class="rounded-full bg-[var(--dash-primary)]/10 px-1 font-semibold text-[var(--dash-primary)] sm:px-1.5"
									>{count}</span
								>
							</span>
						{/each}
					</div>
				{:else}
					<p class="text-xs text-[var(--dash-text-muted)] sm:text-sm">No data found in export</p>
				{/if}
			</div>
		{/if}

		<div class="flex justify-end gap-2">
			<button
				type="button"
				onclick={onSkipToManual}
				class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
			>
				Skip to Manual Entry
			</button>

			{#if isSjsExport}
				<button
					type="button"
					onclick={handleImportContinue}
					disabled={!selectedFile || !exportPreview}
					class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					<FontAwesomeIcon icon={faArrowRight} class="h-4 w-4" />
					Continue
				</button>
			{:else}
				<button
					type="submit"
					disabled={!selectedFile || isLoading}
					class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if isLoading}
						<Spinner size="w-4 h-4" />
						Processing...
					{:else}
						Upload & Parse
					{/if}
				</button>
			{/if}
		</div>
	</form>
</Card>
