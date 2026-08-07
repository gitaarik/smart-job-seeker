<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faTimes, faImage, faExpand, faCheck } from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import { portalToBody } from '$lib/actions/portal';

	interface Props {
		entityType: string;
		entityId: number;
		field: string;
		currentUrl?: string | null;
		label?: string;
		accept?: string;
		showHint?: boolean;
		onUpload?: (url: string) => void;
		onDelete?: () => void;
	}

	let {
		entityType,
		entityId,
		field,
		currentUrl = null,
		label = 'Upload image',
		accept = 'image/jpeg,image/png,image/webp,image/gif',
		showHint = true,
		onUpload,
		onDelete
	}: Props = $props();

	let isUploading = $state(false);
	let isDragging = $state(false);
	let error = $state<string | null>(null);
	let previewUrl = $state<string | null>(currentUrl);
	let showFullPreview = $state(false);
	let markedForDeletion = $state(false);
	let showSuccess = $state(false);

	// Update preview when currentUrl prop changes
	$effect(() => {
		previewUrl = currentUrl;
		markedForDeletion = false;
	});

	async function handleUpload(file: File) {
		if (!file) return;

		error = null;
		isUploading = true;

		try {
			const formData = new FormData();
			formData.append('file', file);

			const response = await fetch(`/api/media/${entityType}/${entityId}/${field}`, {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Upload failed');
			}

			previewUrl = result.url;
			markedForDeletion = false;
			showSuccess = true;
			setTimeout(() => (showSuccess = false), 2000);
			onUpload?.(result.url);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Upload failed';
		} finally {
			isUploading = false;
		}
	}

	async function handleDelete() {
		if (!confirm('Delete this image?')) return;

		try {
			const response = await fetch(`/api/media/${entityType}/${entityId}/${field}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.message || 'Delete failed');
			}

			previewUrl = null;
			markedForDeletion = true;
			onDelete?.();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Delete failed';
		}
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			handleUpload(input.files[0]);
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			handleUpload(files[0]);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	const inputId = $derived(`media-upload-${entityType}-${entityId}-${field}`);
	const deleteFieldName = $derived(`delete_${field}`);
</script>

<div class="space-y-2">
	<!-- Hidden field to track deletion on form submit -->
	<input type="hidden" name={deleteFieldName} value={markedForDeletion ? 'true' : ''} />

	{#if label}
		<label for={inputId} class="block text-sm font-medium text-[var(--dash-text)]">
			{label}
		</label>
	{/if}

	{#if error}
		<div class="text-sm text-[var(--dash-error)]">{error}</div>
	{/if}

	{#if previewUrl}
		<!-- Preview with delete and expand options -->
		<div class="group relative inline-block">
			<img
				src={previewUrl}
				alt="Preview"
				class="h-24 w-24 rounded-lg border-2 object-cover transition-colors
          {showSuccess ? 'border-[var(--dash-success)]' : 'border-[var(--dash-border)]'}"
			/>
			<!-- Success indicator -->
			{#if showSuccess}
				<div
					class="absolute inset-0 flex items-center justify-center rounded-lg bg-[var(--dash-success)]/20 transition-opacity"
				>
					<div
						class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--dash-success)]"
					>
						<FontAwesomeIcon icon={faCheck} class="h-4 w-4 text-white" />
					</div>
				</div>
			{:else}
				<!-- Overlay with expand button on hover -->
				<button
					type="button"
					onclick={() => (showFullPreview = true)}
					class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
					aria-label="View full image"
				>
					<FontAwesomeIcon icon={faExpand} class="h-6 w-6 text-white" />
				</button>
			{/if}
			<!-- Delete button -->
			<button
				type="button"
				onclick={handleDelete}
				class="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--dash-error)] text-white transition-opacity hover:opacity-80"
				aria-label="Remove image"
			>
				<FontAwesomeIcon icon={faTimes} class="h-3 w-3" />
			</button>
		</div>
	{:else}
		<!-- Upload area -->
		<div
			role="button"
			tabindex="0"
			ondrop={handleDrop}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					document.getElementById(inputId)?.click();
				}
			}}
			class="
        relative flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors
        {isDragging
				? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
				: 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/50'}
      "
		>
			{#if isUploading}
				<Spinner size="w-6 h-6" color="var(--dash-primary)" />
			{:else}
				<FontAwesomeIcon icon={faImage} class="mb-1 h-6 w-6 text-[var(--dash-text-muted)]" />
				<span class="text-xs text-[var(--dash-text-muted)]">Upload</span>
			{/if}

			<input
				id={inputId}
				type="file"
				{accept}
				onchange={handleFileSelect}
				disabled={isUploading}
				class="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
			/>
		</div>
	{/if}

	{#if showHint}
		<p class="text-xs text-[var(--dash-text-secondary)]">JPEG, PNG, WebP, or GIF. Max 5MB.</p>
	{/if}
</div>

<!-- Full preview modal -->
{#if showFullPreview && previewUrl}
	<div
		use:portalToBody={{ onClose: () => (showFullPreview = false) }}
		role="dialog"
		aria-modal="true"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
		onclick={() => (showFullPreview = false)}
	>
		<button
			type="button"
			onclick={() => (showFullPreview = false)}
			class="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
			aria-label="Close preview"
		>
			<FontAwesomeIcon icon={faTimes} class="h-5 w-5 text-white" />
		</button>
		<img
			src={previewUrl}
			alt="Full preview"
			class="max-h-full max-w-full rounded-lg object-contain"
			onclick={(e) => e.stopPropagation()}
		/>
	</div>
{/if}
