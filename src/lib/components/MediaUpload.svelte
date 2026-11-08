<!--
	One image slot on a profile row: the profile photo, a role's logo, a side
	project's banner.

	Dropping or choosing a file puts it in the profile's media library and shows
	all of it here. "Choose from library" opens the picker: any picture already
	in the library, cropped for this slot. Removing empties the slot; the picture
	stays in the library (Profile > Media).
-->
<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faTimes, faImage, faExpand, faCheck } from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import { portalToBody } from '$lib/actions/portal';
	import MediaPicker from '$lib/components/media/MediaPicker.svelte';
	import { entitySlotSpec, type Crop } from '$lib/media-library';

	interface Props {
		entityType: string;
		entityId: number;
		/** The slot's name: photo, logo, banner or image. */
		field: string;
		currentUrl?: string | null;
		label?: string;
		accept?: string;
		showHint?: boolean;
		/** The library to pick from; the selected profile when not given. */
		profileId?: number | null;
		onUpload?: (url: string) => void;
		onDelete?: () => void;
	}

	let {
		entityType,
		entityId,
		field,
		currentUrl = null,
		label = 'Upload image',
		accept = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif,image/tiff',
		showHint = true,
		profileId = null,
		onUpload,
		onDelete
	}: Props = $props();

	let isUploading = $state(false);
	let isDragging = $state(false);
	let error = $state<string | null>(null);
	// Follows the prop, and takes the new URL locally after an upload or a pick.
	let previewUrl = $derived<string | null>(currentUrl);
	let showFullPreview = $state(false);
	let showPicker = $state(false);
	let showSuccess = $state(false);

	const endpoint = $derived(`/api/media/${entityType}/${entityId}/${field}`);
	const spec = $derived(entitySlotSpec(entityType, field));

	function shown(url: string) {
		previewUrl = url;
		showSuccess = true;
		setTimeout(() => (showSuccess = false), 2000);
		onUpload?.(url);
	}

	async function handleUpload(file: File) {
		if (!file) return;

		error = null;
		isUploading = true;

		try {
			const formData = new FormData();
			formData.append('file', file);

			const response = await fetch(endpoint, { method: 'POST', body: formData });
			const result = await response.json();
			if (!response.ok) {
				throw new Error(result.message || 'Upload failed');
			}
			shown(result.url);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Upload failed';
		} finally {
			isUploading = false;
		}
	}

	async function handlePick(itemId: number, crop: Crop | null) {
		const response = await fetch(endpoint, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ itemId, crop })
		});
		const result = await response.json();
		if (!response.ok) throw new Error(result.message || 'Could not use that picture');
		error = null;
		shown(result.url);
	}

	async function handleDelete() {
		if (!confirm('Remove this image? It stays in your media library.')) return;

		try {
			const response = await fetch(endpoint, { method: 'DELETE' });

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.message || 'Delete failed');
			}

			previewUrl = null;
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
</script>

<div class="space-y-2">
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
		<div>
			<button
				type="button"
				onclick={() => (showPicker = true)}
				class="text-xs text-[var(--dash-primary)] hover:underline"
			>
				Change or crop
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
		<div>
			<button
				type="button"
				onclick={() => (showPicker = true)}
				class="text-xs text-[var(--dash-primary)] hover:underline"
			>
				Choose from library
			</button>
		</div>
	{/if}

	{#if showHint}
		<p class="text-xs text-[var(--dash-text-secondary)]">
			JPEG, PNG, WebP, GIF, SVG, AVIF or TIFF, up to 25 MB. The original is kept in your media
			library.
		</p>
	{/if}
</div>

{#if showPicker}
	<MediaPicker
		title={spec?.label ?? label ?? 'Choose a picture'}
		kind={spec?.kind ?? 'other'}
		aspect={spec?.aspect ?? null}
		{profileId}
		onpick={handlePick}
		onclose={() => (showPicker = false)}
	/>
{/if}

<!-- Full preview modal -->
{#if showFullPreview && previewUrl}
	<!-- Backdrop: a click anywhere but the image closes, as Escape does. -->
	<button
		type="button"
		use:portalToBody
		class="fixed inset-0 z-40 bg-black/80"
		onclick={() => (showFullPreview = false)}
		tabindex="-1"
		aria-label="Close preview"
	></button>
	<div
		use:portalToBody={{ onClose: () => (showFullPreview = false) }}
		role="dialog"
		aria-modal="true"
		aria-label="Image preview"
		class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
	>
		<button
			type="button"
			onclick={() => (showFullPreview = false)}
			class="pointer-events-auto absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
			aria-label="Close preview"
		>
			<FontAwesomeIcon icon={faTimes} class="h-5 w-5 text-white" />
		</button>
		<img
			src={previewUrl}
			alt="Full preview"
			class="pointer-events-auto max-h-full max-w-full rounded-lg object-contain"
		/>
	</div>
{/if}
