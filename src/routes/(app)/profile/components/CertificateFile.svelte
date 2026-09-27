<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCircleNotch,
		faFileArrowUp,
		faPaperclip,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import {
		CERTIFICATE_FILE_ACCEPT,
		MAX_CERTIFICATE_FILE_BYTES,
		formatFileSize
	} from '$lib/certificate-files';
	import ConfirmModal from './ConfirmModal.svelte';

	/**
	 * The certificate document, in the certificate's expanded card.
	 *
	 * It uploads the moment a file is chosen and never goes through the card's
	 * Save. The fields post a form, and a file input inside it would re-send
	 * the file with every Save; outside it, the file behaves like the skill
	 * chips beside it, which save themselves too.
	 *
	 * `file` is whatever the page last loaded, so after an upload or a removal
	 * the parent reloads and this follows, rather than keeping a copy of its own.
	 */
	interface Props {
		certificateId: number;
		file: { name: string; type: string | null; size: number | null } | null;
		/** After an upload or a removal lands, so the page reloads what it shows. */
		onChanged?: () => void | Promise<void>;
	}

	let { certificateId, file, onChanged }: Props = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);
	let confirmingRemove = $state(false);

	const base = $derived(resolve('/api/certificates/[id]/file', { id: String(certificateId) }));
	// Images open in a tab; a PDF downloads, which is all the route serves it as.
	const isImage = $derived(!!file?.type?.startsWith('image/'));
	const href = $derived((isImage ? `${base}?inline=1` : base) as ResolvedPathname);

	/** The server's own words for a refusal, where it gave some. */
	async function failure(response: Response, fallback: string): Promise<string> {
		const body = (await response.json().catch(() => ({}))) as { message?: string };
		return body.message || fallback;
	}

	async function upload(chosen: File) {
		error = null;
		if (chosen.size > MAX_CERTIFICATE_FILE_BYTES) {
			error = `The file is larger than ${MAX_CERTIFICATE_FILE_BYTES / (1024 * 1024)} MB.`;
			return;
		}
		busy = true;
		try {
			const body = new FormData();
			body.set('file', chosen);
			const response = await fetch(base, { method: 'POST', body });
			if (!response.ok) {
				error = await failure(response, 'The upload failed.');
				return;
			}
			await onChanged?.();
		} catch {
			error = 'The upload failed. Check your connection and try again.';
		} finally {
			busy = false;
		}
	}

	async function remove() {
		confirmingRemove = false;
		error = null;
		busy = true;
		try {
			const response = await fetch(base, { method: 'DELETE' });
			if (!response.ok) {
				error = await failure(response, 'The file could not be removed.');
				return;
			}
			await onChanged?.();
		} catch {
			error = 'The file could not be removed. Check your connection and try again.';
		} finally {
			busy = false;
		}
	}

	function onPick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const chosen = input.files?.[0];
		input.value = '';
		if (chosen) void upload(chosen);
	}
</script>

<div>
	<h4 class="mb-2 text-sm font-medium text-[var(--dash-text)]">Certificate File</h4>
	<div class="flex flex-wrap items-center gap-2">
		{#if file}
			<a
				{href}
				target={isImage ? '_blank' : undefined}
				rel={isImage ? 'noopener' : undefined}
				class="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-[var(--dash-bg)] px-3 py-1.5 text-sm text-[var(--dash-primary)] hover:underline"
			>
				<FontAwesomeIcon icon={faPaperclip} class="h-3 w-3 flex-shrink-0" />
				<span class="truncate">{file.name}</span>
				<span class="flex-shrink-0 text-xs text-[var(--dash-text-muted)]"
					>{formatFileSize(file.size)}</span
				>
			</a>
		{/if}

		<label
			class="inline-flex cursor-pointer items-center gap-1.5 px-3 py-1 text-sm text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] {busy
				? 'pointer-events-none opacity-60'
				: ''}"
		>
			<FontAwesomeIcon icon={busy ? faCircleNotch : faFileArrowUp} spin={busy} class="h-3 w-3" />
			{busy ? 'Working…' : file ? 'Replace' : 'Upload PDF or image'}
			<input
				type="file"
				accept={CERTIFICATE_FILE_ACCEPT}
				disabled={busy}
				onchange={onPick}
				class="sr-only"
			/>
		</label>

		{#if file && !busy}
			<button
				type="button"
				onclick={() => (confirmingRemove = true)}
				class="inline-flex items-center gap-1.5 px-2 py-1 text-sm text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-error)]"
			>
				<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
				Remove
			</button>
		{/if}
	</div>
	<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
		Up to {MAX_CERTIFICATE_FILE_BYTES / (1024 * 1024)} MB. Only you can open it; it is not shown on your
		CV or public pages.
	</p>
	{#if error}
		<p class="mt-1 text-sm text-[var(--dash-error)]">{error}</p>
	{/if}
</div>

<ConfirmModal
	isOpen={confirmingRemove}
	title="Remove Certificate File"
	message="Remove the uploaded file from this certificate? It is deleted for good."
	onCancel={() => (confirmingRemove = false)}
	onConfirm={remove}
/>
