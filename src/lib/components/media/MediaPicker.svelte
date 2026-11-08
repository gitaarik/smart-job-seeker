<!--
	Choose a picture for a slot: one already in the profile's media library, or
	a new upload, then crop it.

	The library keeps every original, so choosing an older picture again, or
	cropping the same one differently for another place, costs nothing and
	asks for no file.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faTimes, faUpload } from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import { portalToBody } from '$lib/actions/portal';
	import CropEditor from './CropEditor.svelte';
	import {
		centredCrop,
		itemPreviewUrl,
		MEDIA_KIND_LABELS,
		type Crop,
		type MediaItemView,
		type MediaKind
	} from '$lib/media-library';

	interface Props {
		title: string;
		/** The kind this slot holds, listed first. */
		kind: MediaKind;
		/** The shape the slot wants, if it has one. */
		aspect?: number | null;
		profileId?: number | null;
		onpick: (itemId: number, crop: Crop | null) => Promise<void> | void;
		onclose: () => void;
	}

	let { title, kind, aspect = null, profileId = null, onpick, onclose }: Props = $props();

	let items = $state<MediaItemView[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let busy = $state(false);
	let allKinds = $state(false);
	let selected = $state<MediaItemView | null>(null);
	let crop = $state<Crop>({ x: 0, y: 0, w: 1, h: 1 });

	const query = $derived(profileId ? `?profileId=${profileId}` : '');
	const shown = $derived(allKinds ? items : items.filter((item) => item.kind === kind));

	async function load() {
		loading = true;
		error = null;
		try {
			const response = await fetch(`/api/media/items${query}`);
			const body = await response.json();
			if (!response.ok) throw new Error(body.message || 'Could not load the library');
			items = body.items;
			// Nothing of this kind yet: show everything rather than an empty grid.
			if (!items.some((item) => item.kind === kind)) allKinds = true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not load the library';
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function choose(item: MediaItemView) {
		selected = item;
		crop = centredCrop(item.width, item.height, aspect);
	}

	async function upload(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		busy = true;
		error = null;
		try {
			const form = new FormData();
			form.append('file', file);
			form.append('kind', kind);
			if (profileId) form.append('profileId', String(profileId));
			const response = await fetch('/api/media/items', { method: 'POST', body: form });
			const body = await response.json();
			if (!response.ok) throw new Error(body.message || 'Upload failed');
			items = [body.item, ...items];
			choose(body.item);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Upload failed';
		} finally {
			busy = false;
			input.value = '';
		}
	}

	async function use(withCrop: boolean) {
		if (!selected) return;
		busy = true;
		error = null;
		try {
			await onpick(selected.id, withCrop ? crop : null);
			onclose();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not use that picture';
		} finally {
			busy = false;
		}
	}
</script>

<button
	type="button"
	use:portalToBody
	class="fixed inset-0 z-40 bg-black/60"
	onclick={onclose}
	tabindex="-1"
	aria-label="Close"
></button>
<div
	use:portalToBody={{ onClose: onclose }}
	role="dialog"
	aria-modal="true"
	aria-label={title}
	class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
>
	<div
		class="pointer-events-auto flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--dash-border)] bg-[var(--dash-card)] shadow-xl"
	>
		<div class="flex items-center justify-between border-b border-[var(--dash-border)] px-4 py-3">
			<h2 class="text-base font-semibold text-[var(--dash-text)]">{title}</h2>
			<button
				type="button"
				onclick={onclose}
				class="rounded p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]"
				aria-label="Close"
			>
				<FontAwesomeIcon icon={faTimes} class="h-4 w-4" />
			</button>
		</div>

		<div class="overflow-y-auto p-4">
			{#if error}
				<p class="mb-3 text-sm text-[var(--dash-error)]">{error}</p>
			{/if}

			{#if selected}
				<CropEditor
					src={itemPreviewUrl(selected.id, 1200)}
					width={selected.width}
					height={selected.height}
					bind:crop
					{aspect}
					label="Crop for {title}"
				/>
				<p class="mt-2 text-xs text-[var(--dash-text-secondary)]">
					{selected.label ?? 'Untitled'}: {selected.width}x{selected.height}, crop {Math.round(
						crop.w
					)}x{Math.round(crop.h)}.
				</p>
			{:else}
				<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
					<label
						class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] hover:border-[var(--dash-primary)]"
					>
						<FontAwesomeIcon icon={faUpload} class="h-3.5 w-3.5" />
						Upload a new picture
						<input
							type="file"
							accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif,image/tiff"
							class="sr-only"
							onchange={upload}
							disabled={busy}
						/>
					</label>
					<label class="inline-flex items-center gap-2 text-sm text-[var(--dash-text-secondary)]">
						<input type="checkbox" bind:checked={allKinds} />
						Show every kind, not only {MEDIA_KIND_LABELS[kind].toLowerCase()}
					</label>
				</div>

				{#if loading || busy}
					<div class="flex justify-center py-10">
						<Spinner size="w-6 h-6" color="var(--dash-primary)" />
					</div>
				{:else if shown.length === 0}
					<p class="py-8 text-center text-sm text-[var(--dash-text-secondary)]">
						Nothing in the library yet. Upload a picture and it stays there, original and all, for
						any slot that needs it.
					</p>
				{:else}
					<ul class="grid grid-cols-3 gap-3 sm:grid-cols-4">
						{#each shown as item (item.id)}
							<li>
								<button
									type="button"
									onclick={() => choose(item)}
									class="group block w-full overflow-hidden rounded-lg border border-[var(--dash-border)] text-left hover:border-[var(--dash-primary)]"
								>
									<span class="block aspect-square bg-[var(--dash-bg)]">
										<img
											src={itemPreviewUrl(item.id, 320)}
											alt=""
											loading="lazy"
											class="h-full w-full object-contain"
										/>
									</span>
									<span class="block truncate px-2 py-1 text-xs text-[var(--dash-text)]"
										>{item.label ?? 'Untitled'}</span
									>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>

		{#if selected}
			<div
				class="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--dash-border)] px-4 py-3"
			>
				<button
					type="button"
					onclick={() => (selected = null)}
					class="mr-auto text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
					disabled={busy}
				>
					Back to the library
				</button>
				{#if !aspect}
					<button
						type="button"
						onclick={() => use(false)}
						disabled={busy}
						class="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] hover:border-[var(--dash-primary)]"
					>
						Use the whole picture
					</button>
				{/if}
				<button
					type="button"
					onclick={() => use(true)}
					disabled={busy}
					class="rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
				>
					{busy ? 'Saving…' : 'Use this crop'}
				</button>
			</div>
		{/if}
	</div>
</div>
