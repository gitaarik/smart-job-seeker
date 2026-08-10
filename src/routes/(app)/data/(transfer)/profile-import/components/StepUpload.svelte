<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowRight,
		faCloudUploadAlt,
		faFile,
		faFileArchive,
		faTimes
	} from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { ExportedProfile } from '$lib/server/profile/export-profile-json';
	import type { ResumeData } from '$lib/server/resume/types';
	import { convertExportToResumeData } from '$lib/resume/convert-export';
	import Card from '../../../../components/Card.svelte';

	interface Props {
		isLoading: boolean;
		error: string | null;
		selectedProfileName?: string;
		onParsed: (data: ResumeData, source: 'upload' | 'import' | 'jsonResume') => void;
		onError: (error: string) => void;
		onLoadingChange: (loading: boolean) => void;
	}

	let { isLoading, error, selectedProfileName, onParsed, onError, onLoadingChange }: Props =
		$props();

	let selectedFile = $state<File | null>(null);
	let isDragging = $state(false);
	let parseError = $state<string | null>(null);

	// Archive restore (ZIP): a full profile write, not a field-level merge, so it
	// posts the file to the server rather than going through diff review — the
	// media bytes and document text can't ride along in a client-side payload.
	let importMode = $state<'new' | 'overwrite'>('new');
	let submitting = $state(false);

	// SJS export detection
	let parsedExport = $state<ExportedProfile | null>(null);
	let exportPreview = $state<{
		name: string;
		title?: string;
		counts: { label: string; count: number }[];
	} | null>(null);

	let isSjsExport = $derived(!!exportPreview);
	const displayError = $derived(error || parseError);

	async function detectFormat(file: File) {
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
				// Not an SJS export — may be JSON Resume
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
			add('Languages', p.languages);
			add('References', p.references);

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

		// Sync to the hidden file input for server-side upload
		const input = document.getElementById('import-file-input') as HTMLInputElement;
		if (input) {
			const dt = new DataTransfer();
			dt.items.add(file);
			input.files = dt.files;
		}

		detectFormat(file);
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
			onParsed(resumeData, 'import');
		} catch {
			onError('Failed to convert export data');
		}
	}

	async function handleUpload() {
		if (!selectedFile) return;

		onLoadingChange(true);
		parseError = null;

		try {
			const formData = new FormData();
			formData.append('file', selectedFile);

			const response = await fetch('/api/resume/parse', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				let message = 'Upload failed';
				try {
					const errorData = await response.json();
					message = errorData.message || errorData.error || message;
				} catch {
					// response wasn't JSON
				}
				onError(message);
				return;
			}

			const result = await response.json();

			if (result.success && result.parsedData) {
				onParsed(result.parsedData as ResumeData, 'upload');
			} else {
				onError('Failed to parse file');
			}
		} catch {
			onError('Upload failed');
		} finally {
			onLoadingChange(false);
		}
	}

	const isZipFile = $derived(
		selectedFile?.name.endsWith('.zip') || selectedFile?.type === 'application/zip'
	);
	const fileIcon = $derived(isZipFile ? faFileArchive : faFile);
</script>

<Card padding="responsive">
	<h3 class="mb-1 font-medium text-[var(--dash-text)]">Import Data</h3>
	<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
		Upload a resume (PDF, DOCX), JSON Resume, or a previous SJS export to compare with your current
		profile — or a full export archive (.zip) to restore it
	</p>

	<form
		method="POST"
		action="?/import"
		enctype="multipart/form-data"
		onsubmit={() => (submitting = true)}
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
					document.getElementById('import-file-input')?.click();
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
					<FontAwesomeIcon
						icon={fileIcon}
						class="h-6 w-6 text-[var(--dash-primary)] sm:h-8 sm:w-8"
					/>
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
					PDF, DOCX or JSON Resume to compare · SJS export .json to compare, .zip to restore
				</p>
			{/if}

			<input
				id="import-file-input"
				name="file"
				type="file"
				accept=".pdf,.docx,.json,.zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/json,application/zip"
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
				{/if}
			</div>
		{/if}

		{#if isZipFile}
			<div
				class="space-y-3 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] p-3 sm:p-4"
			>
				<div>
					<h3 class="text-sm font-semibold text-[var(--dash-text)] sm:text-base">
						Restore from archive
					</h3>
					<p class="mt-1 text-xs text-[var(--dash-text-secondary)] sm:text-sm">
						An export archive holds photos and logos plus the text of documents you uploaded to work
						and personal projects. Those cannot be merged field by field, so an archive is restored
						whole rather than compared.
					</p>
				</div>

				<div class="space-y-2">
					<label class="flex cursor-pointer items-start gap-2">
						<input
							type="radio"
							name="importMode"
							value="new"
							bind:group={importMode}
							class="mt-0.5 h-4 w-4 border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
						/>
						<span class="text-sm text-[var(--dash-text)]">
							Create a new profile
							<span class="block text-xs text-[var(--dash-text-secondary)]">
								Leaves your existing profiles untouched
							</span>
						</span>
					</label>

					<label class="flex cursor-pointer items-start gap-2">
						<input
							type="radio"
							name="importMode"
							value="overwrite"
							bind:group={importMode}
							class="mt-0.5 h-4 w-4 border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
						/>
						<span class="text-sm text-[var(--dash-text)]">
							Replace {selectedProfileName || 'the selected profile'}
							<span class="block text-xs text-[var(--dash-text-secondary)]">
								Deletes its current content first
							</span>
						</span>
					</label>
				</div>

				{#if importMode === 'overwrite'}
					<div class="rounded-lg border border-amber-200 bg-amber-50 p-3">
						<p class="text-xs text-amber-800">
							Everything currently in {selectedProfileName || 'the selected profile'} — including its
							uploaded documents — is deleted and replaced by the archive. This cannot be undone.
						</p>
					</div>
				{/if}
			</div>
		{/if}

		<div class="flex justify-end">
			{#if isZipFile}
				<button
					type="submit"
					disabled={!selectedFile || submitting}
					class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if submitting}
						<Spinner size="w-4 h-4" />
						Restoring...
					{:else}
						<FontAwesomeIcon icon={faFileArchive} class="h-4 w-4" />
						{importMode === 'overwrite' ? 'Replace Profile' : 'Restore as New Profile'}
					{/if}
				</button>
			{:else if isSjsExport}
				<button
					type="button"
					onclick={handleImportContinue}
					disabled={!selectedFile || !exportPreview}
					class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					<FontAwesomeIcon icon={faArrowRight} class="h-4 w-4" />
					Compare with Profile
				</button>
			{:else}
				<button
					type="button"
					onclick={handleUpload}
					disabled={!selectedFile || isLoading}
					class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if isLoading}
						<Spinner size="w-4 h-4" />
						Processing...
					{:else}
						Upload & Compare
					{/if}
				</button>
			{/if}
		</div>
	</form>
</Card>
