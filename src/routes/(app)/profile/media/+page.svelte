<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faImages, faTriangleExclamation, faUpload } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../components/SectionHeader.svelte';
	import Card from '../../components/Card.svelte';
	import { formatBytes, MEDIA_KIND_LABELS, MEDIA_KINDS, type MediaKind } from '$lib/media-library';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let kindFilter = $state<MediaKind | 'all'>('all');
	let showOlder = $state(false);
	let uploadKind = $state<MediaKind>('photo');
	let uploading = $state(false);

	const counts = $derived(
		Object.fromEntries(
			MEDIA_KINDS.map((kind) => [kind, data.items.filter((item) => item.kind === kind).length])
		) as Record<MediaKind, number>
	);
	const shown = $derived(
		data.items.filter(
			(item) =>
				(kindFilter === 'all' || item.kind === kindFilter) && (showOlder || !item.superseded)
		)
	);
	const olderCount = $derived(data.items.filter((item) => item.superseded).length);
</script>

<svelte:head>
	<title>Media - Profile - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader title="Media" icon={faImages} />

	<p class="max-w-3xl text-sm text-[var(--dash-text-secondary)]">
		Every picture your profile shows or a site asks for: profile photos, banners, logos and icons.
		Each is kept once, as you uploaded it, and cut to size for each place it goes, so a new crop or
		a new platform never needs the file again.
	</p>

	{#if data.stale.length > 0}
		<Card padding="lg">
			<h2 class="mb-2 flex items-center gap-2 text-base font-semibold text-[var(--dash-text)]">
				<FontAwesomeIcon icon={faTriangleExclamation} class="h-4 w-4 text-[var(--dash-warning)]" />
				Still showing an older version
			</h2>
			<ul class="space-y-1 text-sm text-[var(--dash-text)]">
				{#each data.stale as stale (`${stale.applicationId}-${stale.renditionId}`)}
					<li>
						<a
							href={resolve('/(app)/applications/[id]', { id: String(stale.applicationId) })}
							class="font-medium text-[var(--dash-primary)] hover:underline">{stale.platform}</a
						>: {stale.slot}, up since {stale.dateUploaded}. A newer version is
						<a
							href={resolve('/(app)/profile/media/[id]', { id: String(stale.newestItemId) })}
							class="text-[var(--dash-primary)] hover:underline"
							>{stale.newestLabel ?? 'in the library'}</a
						>.
					</li>
				{/each}
			</ul>
		</Card>
	{/if}

	<Card padding="lg">
		<form
			method="POST"
			action="?/upload"
			enctype="multipart/form-data"
			use:enhance={() => {
				uploading = true;
				return async ({ update }) => {
					await update();
					uploading = false;
				};
			}}
			class="flex flex-wrap items-end gap-3"
		>
			<label class="text-sm">
				<span class="mb-1 block font-medium text-[var(--dash-text)]">Kind</span>
				<select
					name="kind"
					bind:value={uploadKind}
					class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
				>
					{#each MEDIA_KINDS as kind (kind)}
						<option value={kind}>{MEDIA_KIND_LABELS[kind].replace(/s$/, '')}</option>
					{/each}
				</select>
			</label>
			<label class="min-w-[12rem] flex-1 text-sm">
				<span class="mb-1 block font-medium text-[var(--dash-text)]">Name (optional)</span>
				<input
					name="label"
					placeholder="LinkedIn banner 2026"
					class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
				/>
			</label>
			<label
				class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
			>
				<FontAwesomeIcon icon={faUpload} class="h-4 w-4" />
				{uploading ? 'Uploading…' : 'Upload a picture'}
				<input
					type="file"
					name="file"
					accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif,image/tiff"
					class="sr-only"
					disabled={uploading}
					onchange={(e) => e.currentTarget.form?.requestSubmit()}
				/>
			</label>
		</form>
		<p class="mt-2 text-xs text-[var(--dash-text-secondary)]">
			JPEG, PNG, WebP, GIF, SVG, AVIF or TIFF, up to 25 MB. Location and camera details are taken
			out; the pixels are kept exactly. HEIC (an iPhone's default) cannot be read: export it as a
			JPEG first.
		</p>
		{#if form?.error}
			<p class="mt-2 text-sm text-[var(--dash-error)]">{form.error}</p>
		{/if}
	</Card>

	<div class="flex flex-wrap items-center gap-2">
		<button
			type="button"
			onclick={() => (kindFilter = 'all')}
			class="rounded-full border px-3 py-1 text-sm {kindFilter === 'all'
				? 'border-[var(--dash-primary)] bg-[var(--dash-primary)] text-white'
				: 'border-[var(--dash-border)] text-[var(--dash-text)]'}"
		>
			All ({data.items.length})
		</button>
		{#each MEDIA_KINDS as kind (kind)}
			{#if counts[kind] > 0}
				<button
					type="button"
					onclick={() => (kindFilter = kind)}
					class="rounded-full border px-3 py-1 text-sm {kindFilter === kind
						? 'border-[var(--dash-primary)] bg-[var(--dash-primary)] text-white'
						: 'border-[var(--dash-border)] text-[var(--dash-text)]'}"
				>
					{MEDIA_KIND_LABELS[kind]} ({counts[kind]})
				</button>
			{/if}
		{/each}
		{#if olderCount > 0}
			<label
				class="ml-auto inline-flex items-center gap-2 text-sm text-[var(--dash-text-secondary)]"
			>
				<input type="checkbox" bind:checked={showOlder} />
				Show older versions ({olderCount})
			</label>
		{/if}
		<a
			href={resolve('/(app)/profile/media/banners')}
			class="rounded-full border border-[var(--dash-border)] px-3 py-1 text-sm text-[var(--dash-text)] hover:border-[var(--dash-primary)]"
		>
			Banner templates
		</a>
	</div>

	{#if shown.length === 0}
		<Card padding="lg">
			<p class="text-center text-sm text-[var(--dash-text-secondary)]">
				{data.items.length === 0
					? 'No pictures yet. Upload one above, or through any image slot on your profile: it lands here either way.'
					: 'Nothing of this kind.'}
			</p>
		</Card>
	{:else}
		<ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
			{#each shown as item (item.id)}
				<li>
					<a
						href={resolve('/(app)/profile/media/[id]', { id: String(item.id) })}
						class="group block overflow-hidden rounded-xl border border-[var(--dash-border)] bg-[var(--dash-card)] hover:border-[var(--dash-primary)]"
					>
						<span
							class="flex aspect-[4/3] items-center justify-center bg-[repeating-conic-gradient(#8881_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]"
						>
							<img
								src={item.previewUrl}
								alt=""
								loading="lazy"
								class="max-h-full max-w-full object-contain"
							/>
						</span>
						<span class="block space-y-0.5 px-3 py-2">
							<span class="block truncate text-sm font-medium text-[var(--dash-text)]">
								{item.label ?? 'Untitled'}
							</span>
							<span class="block text-xs text-[var(--dash-text-secondary)]">
								{item.width}x{item.height} · {item.format.toUpperCase()}{item.bytes
									? ` · ${formatBytes(item.bytes)}`
									: ''}
							</span>
							<span class="block text-xs text-[var(--dash-text-secondary)]">
								{item.uses > 0
									? `In use in ${item.uses} place${item.uses === 1 ? '' : 's'}`
									: 'Not in use'}{item.superseded ? ' · older version' : ''}
							</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
