<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCrop,
		faDownload,
		faImage,
		faTriangleExclamation
	} from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../components/SectionHeader.svelte';
	import ConfirmModal from '../../components/ConfirmModal.svelte';
	import Card from '../../../components/Card.svelte';
	import CropEditor from '$lib/components/media/CropEditor.svelte';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import {
		formatBytes,
		itemPreviewUrl,
		MEDIA_KIND_LABELS,
		MEDIA_KINDS,
		MEDIA_MASKS,
		OUTPUT_FORMATS,
		presetName,
		type Crop
	} from '$lib/media-library';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const item = $derived(data.item);
	let editing = $state<number | null>(null);
	let draft = $state<Crop>({ x: 0, y: 0, w: 1, h: 1 });
	let showOtherPresets = $state(false);
	let showAddPreset = $state(false);
	let confirmDelete = $state(false);
	let deleteForm = $state<HTMLFormElement | null>(null);
	let busy = $state(false);

	const slotUses = $derived(data.uses.filter((use) => !use.record));
	const recordUses = $derived(data.uses.filter((use) => use.record));
	const suiting = $derived(data.presets.filter((p) => p.suits));
	const others = $derived(data.presets.filter((p) => !p.suits));
	const today = new Date().toISOString().slice(0, 10);

	/** Platforms with more than one preset this picture is cropped for: a zip is worth offering. */
	const zipPlatforms = $derived(
		[...new Set(data.presets.filter((p) => p.current).map((p) => p.preset.platform))].filter(
			(platform) =>
				data.presets.filter((p) => p.preset.platform === platform && p.current).length > 1
		)
	);

	function edit(entry: (typeof data.presets)[number]) {
		editing = entry.preset.id;
		draft = { ...entry.startCrop };
	}

	function saving() {
		busy = true;
		return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			busy = false;
			editing = null;
		};
	}
</script>

<svelte:head>
	<title>{item.label ?? 'Picture'} - Media - Smart Job Seeker</title>
</svelte:head>

{#snippet presetRow(entry: (typeof data.presets)[number])}
	{@const preset = entry.preset}
	<li class="border-t border-[var(--dash-border)] py-4 first:border-t-0 first:pt-0">
		<div class="flex flex-wrap items-start gap-4">
			<div
				class="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded border border-[var(--dash-border)] bg-[var(--dash-bg)]"
			>
				{#if entry.current}
					<img
						src={`/api/media/renditions/${entry.current.renditionId}`}
						alt=""
						class="max-h-full max-w-full object-contain {preset.mask === 'circle'
							? 'rounded-full'
							: preset.mask === 'rounded'
								? 'rounded-lg'
								: ''}"
					/>
				{:else}
					<span class="text-xs text-[var(--dash-text-muted)]">Not cropped yet</span>
				{/if}
			</div>
			<div class="min-w-0 flex-1 space-y-1">
				<p class="font-medium text-[var(--dash-text)]">
					{presetName(preset)}
					<span class="ml-1 text-xs font-normal text-[var(--dash-text-secondary)]">
						{preset.width}x{preset.height} · {preset.formats
							.map((f) => f.toUpperCase())
							.join(', ')}{preset.maxBytes
							? ` · up to ${formatBytes(preset.maxBytes)}`
							: ''}{preset.own ? ' · yours' : ''}
					</span>
				</p>
				{#if preset.note}
					<p class="text-xs text-[var(--dash-text-secondary)]">{preset.note}</p>
				{/if}
				<p class="text-xs text-[var(--dash-text-secondary)]">
					{#if preset.sourceUrl}
						Numbers from <ExternalLink
							href={preset.sourceUrl}
							class="text-[var(--dash-primary)] hover:underline"
							>{new URL(preset.sourceUrl).hostname}</ExternalLink
						>{preset.verifiedOn ? `, read ${preset.verifiedOn}` : ''}.
					{:else}
						No source recorded for these numbers.
					{/if}
				</p>
				{#if entry.current?.bytes}
					<p class="text-xs text-[var(--dash-text-secondary)]">
						Saved crop: {entry.current.width}x{entry.current.height}
						{entry.current.format.toUpperCase()}, {formatBytes(entry.current.bytes)}.
					</p>
				{/if}
				{#each entry.warnings as warning (warning.kind)}
					<p class="flex items-start gap-1.5 text-xs text-[var(--dash-warning)]">
						<FontAwesomeIcon icon={faTriangleExclamation} class="mt-0.5 h-3 w-3 shrink-0" />
						{warning.message}
					</p>
				{/each}
			</div>
			<div class="flex shrink-0 flex-wrap gap-2">
				<button
					type="button"
					onclick={() => edit(entry)}
					class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] hover:border-[var(--dash-primary)]"
				>
					<FontAwesomeIcon icon={faCrop} class="h-3.5 w-3.5" />
					{entry.current ? 'Recrop' : 'Crop'}
				</button>
				{#if entry.current}
					<a
						href={resolve('/api/media/renditions/[id]/download', {
							id: entry.current.renditionId
						})}
						class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] hover:border-[var(--dash-primary)]"
					>
						<FontAwesomeIcon icon={faDownload} class="h-3.5 w-3.5" />
						Download
					</a>
				{/if}
				{#if preset.own}
					<form method="POST" action="?/deletePreset" use:enhance>
						<input type="hidden" name="presetId" value={preset.id} />
						<button
							type="submit"
							class="rounded-lg px-2 py-1.5 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)]"
						>
							Remove preset
						</button>
					</form>
				{/if}
			</div>
		</div>

		{#if editing === preset.id}
			<div class="mt-4 space-y-3 rounded-lg border border-[var(--dash-border)] p-3">
				<CropEditor
					src={itemPreviewUrl(item.id, 1400)}
					width={item.width}
					height={item.height}
					bind:crop={draft}
					aspect={preset.width / preset.height}
					mask={preset.mask}
					zones={preset.safeZone}
					zoneWidth={preset.width}
					zoneHeight={preset.height}
					label="Crop for {presetName(preset)}"
				/>
				{#if draft.w < preset.width || draft.h < preset.height}
					<p class="flex items-start gap-1.5 text-xs text-[var(--dash-warning)]">
						<FontAwesomeIcon icon={faTriangleExclamation} class="mt-0.5 h-3 w-3 shrink-0" />
						The crop is {Math.round(draft.w)}x{Math.round(draft.h)}, smaller than the
						{preset.width}x{preset.height} this needs, so it would be enlarged and look soft.
					</p>
				{/if}
				<form
					method="POST"
					action="?/saveCrop"
					use:enhance={saving}
					class="flex flex-wrap items-center gap-2"
				>
					<input type="hidden" name="presetId" value={preset.id} />
					<input type="hidden" name="crop" value={JSON.stringify(draft)} />
					<button
						type="submit"
						disabled={busy}
						class="rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
					>
						{busy ? 'Saving…' : 'Save crop'}
					</button>
					<button
						type="button"
						onclick={() => (editing = null)}
						class="rounded-lg px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
					>
						Cancel
					</button>
				</form>
			</div>
		{/if}

		{#if entry.current && data.applications.length > 0}
			<form
				method="POST"
				action="?/recordUpload"
				use:enhance
				class="mt-3 flex flex-wrap items-center gap-2 text-xs"
			>
				<input type="hidden" name="renditionId" value={entry.current.renditionId} />
				<span class="text-[var(--dash-text-secondary)]">Put this up on</span>
				<select
					name="applicationId"
					aria-label="Application"
					class="max-w-[16rem] rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-[var(--dash-text)]"
				>
					{#each data.applications as application (application.id)}
						<option value={application.id}>{application.name}</option>
					{/each}
				</select>
				<span class="text-[var(--dash-text-secondary)]">on</span>
				<input
					type="date"
					name="dateUploaded"
					value={today}
					aria-label="Date uploaded"
					class="rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-[var(--dash-text)]"
				/>
				<button
					type="submit"
					class="rounded border border-[var(--dash-border)] px-2 py-1 text-[var(--dash-text)] hover:border-[var(--dash-primary)]"
				>
					Record it
				</button>
			</form>
		{/if}
	</li>
{/snippet}

<div class="space-y-6">
	<SectionHeader
		title={item.label ?? 'Picture'}
		icon={faImage}
		backHref={resolve('/(app)/profile/media')}
		backLabel="Media"
	/>

	{#if form && 'error' in form && form.error}
		<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
	{/if}
	{#if form && 'moved' in form}
		<p class="text-sm text-[var(--dash-success)]">
			Now shown in {form.moved} place{form.moved === 1 ? '' : 's'} on your profile.
		</p>
	{/if}

	<div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
		<Card padding="lg">
			<div
				class="flex items-center justify-center rounded-lg bg-[repeating-conic-gradient(#8881_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]"
			>
				<img
					src={itemPreviewUrl(item.id, 800)}
					alt={item.label ?? ''}
					class="max-h-80 object-contain"
				/>
			</div>
			<dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
				<dt class="text-[var(--dash-text-secondary)]">Size</dt>
				<dd class="text-[var(--dash-text)]">{item.width}x{item.height}</dd>
				<dt class="text-[var(--dash-text-secondary)]">Original</dt>
				<dd class="text-[var(--dash-text)]">
					{item.format.toUpperCase()}{item.bytes
						? `, ${formatBytes(item.bytes)}`
						: ''}{item.hasAlpha ? ', transparent' : ''}
				</dd>
				{#if data.template}
					<dt class="text-[var(--dash-text-secondary)]">Made from</dt>
					<dd class="text-[var(--dash-text)]">
						<a
							href={resolve('/(app)/profile/media/banners')}
							class="text-[var(--dash-primary)] hover:underline"
							>the "{data.template.name}" banner</a
						>
					</dd>
				{/if}
			</dl>
			<a
				href={resolve('/api/media/items/[id]/original', { id: String(item.id) })}
				class="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--dash-primary)] hover:underline"
			>
				<FontAwesomeIcon icon={faDownload} class="h-3.5 w-3.5" />
				Download the original
			</a>

			<form method="POST" action="?/update" use:enhance class="mt-5 space-y-3">
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-[var(--dash-text)]">Name</span>
					<input
						name="label"
						value={item.label ?? ''}
						class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
					/>
				</label>
				<label class="block text-sm">
					<span class="mb-1 block font-medium text-[var(--dash-text)]">Kind</span>
					<select
						name="kind"
						value={item.kind}
						class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
					>
						{#each MEDIA_KINDS as kind (kind)}
							<option value={kind}>{MEDIA_KIND_LABELS[kind].replace(/s$/, '')}</option>
						{/each}
					</select>
				</label>
				<button
					type="submit"
					class="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] hover:border-[var(--dash-primary)]"
				>
					Save
				</button>
			</form>
		</Card>

		<div class="space-y-6">
			<Card padding="lg">
				<h2 class="mb-2 text-base font-semibold text-[var(--dash-text)]">Where it is used</h2>
				{#if data.uses.length === 0}
					<p class="text-sm text-[var(--dash-text-secondary)]">
						Nowhere yet. Choose it from the library on any image slot (your profile photo, a role's
						logo, a theme's images), or crop it for a platform below.
					</p>
				{:else}
					<ul class="space-y-1 text-sm">
						{#each slotUses as use (`${use.kind}-${use.href}-${use.label}`)}
							<li>
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built from a route id per kind in usage.ts -->
								<a href={use.href} class="text-[var(--dash-primary)] hover:underline">{use.label}</a
								>
							</li>
						{/each}
						{#each recordUses as use (`${use.href}-${use.renditionId}-${use.dateUploaded}`)}
							<li>
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- an application's page, built in usage.ts -->
								<a href={use.href} class="text-[var(--dash-primary)] hover:underline">{use.label}</a
								>
								<span class="text-[var(--dash-text-secondary)]">on {use.dateUploaded}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</Card>

			<Card padding="lg">
				<h2 class="mb-2 text-base font-semibold text-[var(--dash-text)]">Versions</h2>
				<div class="space-y-2 text-sm text-[var(--dash-text)]">
					{#if data.replaces}
						<p>
							A new version of
							<a
								href={resolve('/(app)/profile/media/[id]', { id: String(data.replaces.id) })}
								class="text-[var(--dash-primary)] hover:underline"
								>{data.replaces.label ?? 'an older picture'}</a
							>.
						</p>
						<form method="POST" action="?/useEverywhere" use:enhance>
							<button
								type="submit"
								class="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm hover:border-[var(--dash-primary)]"
							>
								Show this version everywhere the old one shows
							</button>
						</form>
					{/if}
					{#each data.replacedBy as newer (newer.id)}
						<p>
							Replaced by
							<a
								href={resolve('/(app)/profile/media/[id]', { id: String(newer.id) })}
								class="text-[var(--dash-primary)] hover:underline"
								>{newer.label ?? 'a newer picture'}</a
							>.
						</p>
					{/each}
					<form
						method="POST"
						action="?/uploadVersion"
						enctype="multipart/form-data"
						use:enhance
						class="flex flex-wrap items-center gap-3"
					>
						<label
							class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 hover:border-[var(--dash-primary)]"
						>
							Upload a new version
							<input
								type="file"
								name="file"
								accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif,image/tiff"
								class="sr-only"
								onchange={(e) => e.currentTarget.form?.requestSubmit()}
							/>
						</label>
						<label class="inline-flex items-center gap-2 text-[var(--dash-text-secondary)]">
							<input type="checkbox" name="useEverywhere" value="1" checked />
							and show it wherever this one shows
						</label>
					</form>
					<p class="text-xs text-[var(--dash-text-secondary)]">
						The old version stays, so the platforms still showing it can be listed until you update
						them.
					</p>
				</div>
			</Card>
		</div>
	</div>

	<Card padding="lg">
		<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
			<h2 class="text-base font-semibold text-[var(--dash-text)]">For platforms</h2>
			{#each zipPlatforms as platform (platform)}
				<a
					href={resolve('/api/media/platform-zip/[platform]', { platform })}
					class="inline-flex items-center gap-1.5 text-sm text-[var(--dash-primary)] hover:underline"
				>
					<FontAwesomeIcon icon={faDownload} class="h-3.5 w-3.5" />
					Everything {platform} needs (zip)
				</a>
			{/each}
		</div>
		<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
			Each preset is what a site asks for. The outline shows the shape it crops to, hatched red is
			covered by something else there, and the dashed yellow box is the part every screen shows.
		</p>
		{#if suiting.length === 0 && others.length === 0}
			<p class="text-sm text-[var(--dash-text-secondary)]">No presets yet.</p>
		{:else}
			<ul>
				{#each suiting as entry (entry.preset.id)}
					{@render presetRow(entry)}
				{/each}
			</ul>
			{#if others.length > 0}
				<button
					type="button"
					onclick={() => (showOtherPresets = !showOtherPresets)}
					class="mt-3 text-sm text-[var(--dash-primary)] hover:underline"
				>
					{showOtherPresets ? 'Hide' : 'Show'} presets for other kinds of picture ({others.length})
				</button>
				{#if showOtherPresets}
					<ul class="mt-3">
						{#each others as entry (entry.preset.id)}
							{@render presetRow(entry)}
						{/each}
					</ul>
				{/if}
			{/if}
		{/if}

		<div class="mt-5 border-t border-[var(--dash-border)] pt-4">
			<button
				type="button"
				onclick={() => (showAddPreset = !showAddPreset)}
				class="text-sm text-[var(--dash-primary)] hover:underline"
			>
				{showAddPreset ? 'Close' : 'Add a preset for a site not listed'}
			</button>
			{#if form && 'presetError' in form && form.presetError}
				<p class="mt-2 text-sm text-[var(--dash-error)]">{form.presetError}</p>
			{/if}
			{#if showAddPreset}
				<form
					method="POST"
					action="?/addPreset"
					use:enhance
					class="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"
				>
					<label>
						<span class="mb-1 block text-[var(--dash-text)]">Site</span>
						<input
							name="platform"
							required
							placeholder="Upwork"
							class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-[var(--dash-text)]"
						/>
					</label>
					<label>
						<span class="mb-1 block text-[var(--dash-text)]">Image</span>
						<input
							name="slot"
							required
							placeholder="Profile photo"
							class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-[var(--dash-text)]"
						/>
					</label>
					<label>
						<span class="mb-1 block text-[var(--dash-text)]">Width (px)</span>
						<input
							name="width"
							type="number"
							min="16"
							max="8000"
							required
							class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-[var(--dash-text)]"
						/>
					</label>
					<label>
						<span class="mb-1 block text-[var(--dash-text)]">Height (px)</span>
						<input
							name="height"
							type="number"
							min="16"
							max="8000"
							required
							class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-[var(--dash-text)]"
						/>
					</label>
					<label>
						<span class="mb-1 block text-[var(--dash-text)]">Largest file (KB)</span>
						<input
							name="maxKb"
							type="number"
							min="1"
							class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-[var(--dash-text)]"
						/>
					</label>
					<label>
						<span class="mb-1 block text-[var(--dash-text)]">Shown as</span>
						<select
							name="mask"
							class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-[var(--dash-text)]"
						>
							{#each MEDIA_MASKS as mask (mask)}
								<option value={mask}>{mask === 'none' ? 'as cropped' : mask}</option>
							{/each}
						</select>
					</label>
					<label>
						<span class="mb-1 block text-[var(--dash-text)]">For</span>
						<select
							name="kind"
							value={item.kind}
							class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-[var(--dash-text)]"
						>
							{#each MEDIA_KINDS as kind (kind)}
								<option value={kind}>{MEDIA_KIND_LABELS[kind].toLowerCase()}</option>
							{/each}
						</select>
					</label>
					<fieldset>
						<legend class="mb-1 block text-[var(--dash-text)]">Formats it takes</legend>
						{#each OUTPUT_FORMATS as format (format)}
							<label class="mr-3 inline-flex items-center gap-1 text-[var(--dash-text-secondary)]">
								<input type="checkbox" name="formats" value={format} checked={format !== 'webp'} />
								{format.toUpperCase()}
							</label>
						{/each}
					</fieldset>
					<label class="sm:col-span-2">
						<span class="mb-1 block text-[var(--dash-text)]">Where the numbers come from (URL)</span
						>
						<input
							name="sourceUrl"
							type="url"
							placeholder="https://"
							class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-[var(--dash-text)]"
						/>
					</label>
					<label class="sm:col-span-2">
						<span class="mb-1 block text-[var(--dash-text)]">Note</span>
						<input
							name="note"
							class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-[var(--dash-text)]"
						/>
					</label>
					<div class="sm:col-span-2 lg:col-span-4">
						<button
							type="submit"
							class="rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 font-medium text-white hover:opacity-90"
						>
							Add preset
						</button>
					</div>
				</form>
			{/if}
		</div>
	</Card>

	<div>
		<button
			type="button"
			onclick={() => (confirmDelete = true)}
			class="text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)]"
		>
			Delete this picture
		</button>
		<form bind:this={deleteForm} method="POST" action="?/delete" class="hidden"></form>
	</div>
</div>

<ConfirmModal
	isOpen={confirmDelete}
	title="Delete this picture?"
	message={slotUses.length > 0
		? `Its original and every crop go, and these go blank: ${slotUses.map((u) => u.label).join(', ')}.`
		: 'Its original and every crop of it go. Nothing on your profile shows it.'}
	confirmLabel="Delete"
	onConfirm={() => deleteForm?.requestSubmit()}
	onCancel={() => (confirmDelete = false)}
/>
