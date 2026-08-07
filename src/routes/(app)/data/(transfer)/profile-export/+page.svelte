<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faDatabase,
		faDownload,
		faImage,
		faUser,
		faLayerGroup
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../../../components/Card.svelte';
	import EmptyState from '../../../profile/components/EmptyState.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let exports = $derived(data.exports);
	let exporting = $state(false);

	// Export options
	let scope = $state<'profile' | 'full'>('profile');
	let includeMedia = $state(false);

	function formatDate(date: Date | string | null): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getFileTypeLabel(type: string): string {
		switch (type) {
			case 'pdf':
				return 'PDF';
			case 'html':
				return 'HTML';
			case 'docx':
				return 'Word';
			case 'json':
				return 'JSON';
			case 'zip':
				return 'ZIP';
			case 'txt':
				return 'Text';
			default:
				return type.toUpperCase();
		}
	}

	function formatFileSize(bytes: bigint | number | null | undefined): string {
		if (!bytes) return '';
		const size = Number(bytes);
		if (size < 1024) return `${size} B`;
		if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
		return `${(size / (1024 * 1024)).toFixed(1)} MB`;
	}

	function handleExport() {
		exporting = true;
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			await update();
			exporting = false;
		};
	}

	const exportDescription = $derived.by(() => {
		const scopeText =
			scope === 'full' ? 'full account (profile + job tracking data)' : 'profile data (resume/CV)';
		const mediaText = includeMedia ? ' with media files' : '';
		return `Export your ${scopeText}${mediaText}`;
	});

	const exportButtonText = $derived.by(() => {
		if (exporting) return 'Exporting...';
		const format = includeMedia ? 'ZIP' : 'JSON';
		const scopeText = scope === 'full' ? 'Full Account' : 'Profile';
		return `Export ${scopeText} (${format})`;
	});
</script>

<svelte:head>
	<title>Export - Data & Settings - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	{#if form?.error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
		</div>
	{/if}

	{#if form?.success}
		<div class="rounded-lg border border-[var(--dash-success)] bg-[var(--dash-success-light)] p-4">
			<p class="text-sm text-[var(--dash-success)]">
				Data exported successfully. You can download it from the list below.
			</p>
		</div>
	{/if}

	<!-- Export Options -->
	<Card padding="lg">
		<div class="flex items-start gap-4">
			<div
				class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--dash-bg)]"
			>
				<FontAwesomeIcon icon={faDatabase} class="h-6 w-6 text-indigo-600" />
			</div>
			<div class="flex-1">
				<h3 class="mb-1 font-medium text-[var(--dash-text)]">Export Options</h3>
				<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
					{exportDescription}
				</p>

				<form method="POST" action="?/export" use:enhance={handleExport}>
					<input type="hidden" name="scope" value={scope} />
					<input type="hidden" name="includeMedia" value={includeMedia.toString()} />

					<!-- Scope Selection -->
					<div class="mb-4">
						<label class="mb-2 block text-sm font-medium text-[var(--dash-text)]"
							>What to export</label
						>
						<div class="flex flex-col gap-3 sm:flex-row">
							<button
								type="button"
								onclick={() => (scope = 'profile')}
								class="flex flex-1 items-center gap-3 rounded-lg border p-3 transition-colors {scope ===
								'profile'
									? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
									: 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/50'}"
							>
								<FontAwesomeIcon
									icon={faUser}
									class="h-5 w-5 {scope === 'profile'
										? 'text-[var(--dash-primary)]'
										: 'text-[var(--dash-text-muted)]'}"
								/>
								<div class="text-left">
									<div
										class="font-medium {scope === 'profile'
											? 'text-[var(--dash-primary)]'
											: 'text-[var(--dash-text)]'}"
									>
										Profile Only
									</div>
									<div class="text-xs text-[var(--dash-text-secondary)]">
										Resume, skills, experience
									</div>
								</div>
							</button>
							<button
								type="button"
								onclick={() => (scope = 'full')}
								class="flex flex-1 items-center gap-3 rounded-lg border p-3 transition-colors {scope ===
								'full'
									? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
									: 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/50'}"
							>
								<FontAwesomeIcon
									icon={faLayerGroup}
									class="h-5 w-5 {scope === 'full'
										? 'text-[var(--dash-primary)]'
										: 'text-[var(--dash-text-muted)]'}"
								/>
								<div class="text-left">
									<div
										class="font-medium {scope === 'full'
											? 'text-[var(--dash-primary)]'
											: 'text-[var(--dash-text)]'}"
									>
										Full Account
									</div>
									<div class="text-xs text-[var(--dash-text-secondary)]">
										Profile + stories, notes, salary
									</div>
								</div>
							</button>
						</div>
					</div>

					<!-- Media Option -->
					<div class="mb-4">
						<label
							class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors {includeMedia
								? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
								: 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/50'}"
						>
							<input
								type="checkbox"
								bind:checked={includeMedia}
								class="h-4 w-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
							/>
							<FontAwesomeIcon
								icon={faImage}
								class="h-5 w-5 {includeMedia
									? 'text-[var(--dash-primary)]'
									: 'text-[var(--dash-text-muted)]'}"
							/>
							<div>
								<div
									class="font-medium {includeMedia
										? 'text-[var(--dash-primary)]'
										: 'text-[var(--dash-text)]'}"
								>
									Include media files
								</div>
								<div class="text-xs text-[var(--dash-text-secondary)]">
									Profile photos, logos, images (creates ZIP file)
								</div>
							</div>
						</label>
					</div>

					<button
						type="submit"
						disabled={exporting}
						class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if exporting}
							<span
								class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
							></span>
							Exporting...
						{:else}
							<FontAwesomeIcon icon={faDownload} class="h-4 w-4" />
							{exportButtonText}
						{/if}
					</button>
				</form>
			</div>
		</div>
	</Card>

	<!-- Existing Exports -->
	{#if exports.length > 0}
		<div>
			<h2 class="mb-4 text-lg font-semibold text-[var(--dash-text)]">Previous Exports</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each exports as exp (exp.id)}
					<a
						href="/data/profile-export/download?id={exp.id}"
						download
						class="block rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4 transition-colors hover:border-[var(--dash-primary)]"
					>
						<div class="flex items-center gap-3">
							<div
								class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--dash-bg)]"
							>
								<FontAwesomeIcon icon={faDownload} class="h-5 w-5 text-gray-600" />
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span
										class="rounded bg-[var(--dash-bg)] px-2 py-0.5 text-xs font-medium text-gray-700"
									>
										{getFileTypeLabel(exp.file_type)}
									</span>
									<span class="text-xs text-[var(--dash-text-secondary)]">
										{exp.export_format || exp.export_type}
									</span>
								</div>
								<p class="mt-1 truncate text-sm text-[var(--dash-text)]">
									{exp.description || 'Export file'}
								</p>
								<div class="flex items-center gap-2 text-xs text-[var(--dash-text-secondary)]">
									<span>{formatDate(exp.date_created)}</span>
									{#if exp.file?.filesize}
										<span>•</span>
										<span>{formatFileSize(exp.file.filesize)}</span>
									{/if}
								</div>
							</div>
						</div>
					</a>
				{/each}
			</div>
		</div>
	{:else}
		<EmptyState
			icon={faDatabase}
			title="No data exports yet"
			description="Export your profile data to create a backup or transfer your information. Choose your options above and click export."
		/>
	{/if}
</div>
