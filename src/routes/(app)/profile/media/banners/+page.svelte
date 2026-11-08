<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { faPanorama } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../components/SectionHeader.svelte';
	import Card from '../../../components/Card.svelte';
	import MediaPicker from '$lib/components/media/MediaPicker.svelte';
	import {
		BANNER_MEDIA_SLOTS,
		presetName,
		type BannerMediaSlot,
		type Crop
	} from '$lib/media-library';
	import { BANNER_ALIGNMENTS } from '$lib/banner-templates';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let pickerFor = $state<{ id: number; slot: BannerMediaSlot } | null>(null);
	let drawing = $state<number | null>(null);
	const previewWidths: Record<number, number> = $state({});

	const bannerPresets = $derived(data.presets.filter((p) => p.kind === 'banner'));
	const otherPresets = $derived(data.presets.filter((p) => p.kind !== 'banner'));

	async function pickAsset(id: number, slot: BannerMediaSlot, itemId: number, crop: Crop | null) {
		const body = new FormData();
		body.set('id', String(id));
		body.set('slot', slot);
		body.set('itemId', String(itemId));
		if (crop) body.set('crop', JSON.stringify(crop));
		const response = await fetch('?/pickAsset', {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' }
		});
		const result = deserialize(await response.text());
		if (result.type === 'failure' || result.type === 'error') {
			throw new Error('Could not use that picture');
		}
		await invalidateAll();
	}

	function presetLabel(id: number | null) {
		const preset = data.presets.find((p) => p.id === id);
		return preset ? presetName(preset) : 'Removed preset';
	}
</script>

<svelte:head>
	<title>Banner templates - Media - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader
		title="Banner templates"
		icon={faPanorama}
		backHref={resolve('/(app)/profile/media')}
		backLabel="Media"
	/>

	<p class="max-w-3xl text-sm text-[var(--dash-text-secondary)]">
		A banner made from your profile: your name, your title (or a resume version's wording of it) and
		a last line, in a portfolio theme's colours. Drawing it makes one picture per size you choose,
		filed in your media library as a new version of the last drawing, so every platform that still
		shows the old one is listed there.
	</p>

	{#if form && 'error' in form && form.error}
		<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
	{/if}

	{#each data.banners as banner (banner.id)}
		<Card padding="lg">
			{#if banner.preview}
				{@const scale = (previewWidths[banner.id] ?? 0) / banner.preview.width}
				<div
					class="relative mb-4 w-full overflow-hidden rounded-lg border border-[var(--dash-border)]"
					style:aspect-ratio="{banner.preview.width} / {banner.preview.height}"
					bind:clientWidth={previewWidths[banner.id]}
				>
					{#if scale > 0}
						<iframe
							title="Preview of {banner.name}"
							srcdoc={banner.preview.html}
							sandbox="allow-same-origin"
							class="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
							style:width="{banner.preview.width}px"
							style:height="{banner.preview.height}px"
							style:transform="scale({scale})"
						></iframe>
					{/if}
				</div>
			{:else}
				<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
					Choose at least one size below to see a preview.
				</p>
			{/if}

			<form method="POST" action="?/save" use:enhance class="grid gap-4 text-sm md:grid-cols-2">
				<input type="hidden" name="id" value={banner.id} />
				<label>
					<span class="mb-1 block font-medium text-[var(--dash-text)]">Name of this banner</span>
					<input
						name="bannerName"
						value={banner.name}
						class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
					/>
				</label>
				<label>
					<span class="mb-1 block font-medium text-[var(--dash-text)]">Colours and fonts from</span>
					<select
						name="themeId"
						value={banner.config.themeId ?? ''}
						class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
					>
						<option value="">The default look</option>
						{#each data.themes as theme (theme.id)}
							<option value={theme.id}>{theme.name}</option>
						{/each}
					</select>
				</label>
				<label>
					<span class="mb-1 block font-medium text-[var(--dash-text)]">Light or dark</span>
					<select
						name="scheme"
						value={banner.config.scheme ?? ''}
						class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
					>
						<option value="">As the theme is set</option>
						<option value="dark">Dark</option>
						<option value="light">Light</option>
					</select>
				</label>
				<label>
					<span class="mb-1 block font-medium text-[var(--dash-text)]">Words from</span>
					<select
						name="versionId"
						value={banner.config.versionId ?? ''}
						class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
					>
						<option value="">The profile</option>
						{#each data.versions as version (version.id)}
							<option value={version.id}>The "{version.name ?? version.slug}" version</option>
						{/each}
					</select>
				</label>
				<label>
					<span class="mb-1 block font-medium text-[var(--dash-text)]">Name shown</span>
					<input
						name="name"
						value={banner.config.name}
						placeholder="Your profile's name"
						class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
					/>
				</label>
				<div>
					<span class="mb-1 block font-medium text-[var(--dash-text)]">Under the name</span>
					<div class="flex items-center gap-4 text-[var(--dash-text-secondary)]">
						<label class="inline-flex items-center gap-1.5">
							<input
								type="radio"
								name="line"
								value="title"
								checked={banner.config.line === 'title'}
							/>
							Title
						</label>
						<label class="inline-flex items-center gap-1.5">
							<input
								type="radio"
								name="line"
								value="headline"
								checked={banner.config.line === 'headline'}
							/>
							Headline
						</label>
					</div>
					<input
						name="title"
						value={banner.config.title}
						placeholder="Or other words"
						class="mt-2 w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
					/>
				</div>
				<div>
					<span class="mb-1 block font-medium text-[var(--dash-text)]">Last line</span>
					<label class="inline-flex items-center gap-1.5 text-[var(--dash-text-secondary)]">
						<input type="checkbox" name="useStack" checked={banner.config.tagline === null} />
						Your core stack
					</label>
					<input
						name="tagline"
						value={banner.config.tagline ?? ''}
						placeholder="Or other words, or nothing"
						class="mt-2 w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
					/>
				</div>
				<div class="space-y-2">
					<label class="block">
						<span class="mb-1 block font-medium text-[var(--dash-text)]">Words sit</span>
						<select
							name="align"
							value={banner.config.align}
							class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
						>
							{#each BANNER_ALIGNMENTS as align (align)}
								<option value={align}
									>{align === 'center' ? 'in the middle' : `on the ${align}`}</option
								>
							{/each}
						</select>
					</label>
					<label class="inline-flex items-center gap-1.5 text-[var(--dash-text-secondary)]">
						<input type="checkbox" name="showLogo" checked={banner.config.showLogo} />
						Show the logo
					</label>
				</div>
				<fieldset class="md:col-span-2">
					<legend class="mb-1 font-medium text-[var(--dash-text)]">Draw it at</legend>
					<div class="flex flex-wrap gap-x-4 gap-y-1 text-[var(--dash-text-secondary)]">
						{#each [...bannerPresets, ...otherPresets] as preset (preset.id)}
							<label class="inline-flex items-center gap-1.5">
								<input
									type="checkbox"
									name="presetIds"
									value={preset.id}
									checked={banner.config.presetIds.includes(preset.id)}
								/>
								{presetName(preset)} ({preset.width}x{preset.height})
							</label>
						{/each}
					</div>
				</fieldset>
				<div class="flex flex-wrap gap-2 md:col-span-2">
					<button
						type="submit"
						class="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-[var(--dash-text)] hover:border-[var(--dash-primary)]"
					>
						Save and preview
					</button>
				</div>
			</form>

			<div
				class="mt-4 flex flex-wrap items-center gap-4 border-t border-[var(--dash-border)] pt-4 text-sm"
			>
				{#each Object.entries(BANNER_MEDIA_SLOTS) as [key, spec] (key)}
					{@const current = banner.assets[key]}
					<div class="flex items-center gap-2">
						{#if current}
							<img src={`/assets/${current}`} alt="" class="h-10 w-16 rounded object-contain" />
						{/if}
						<button
							type="button"
							onclick={() => (pickerFor = { id: banner.id, slot: key as BannerMediaSlot })}
							class="rounded-lg border border-[var(--dash-border)] px-2 py-1 text-[var(--dash-text)] hover:border-[var(--dash-primary)]"
						>
							{current
								? `Change ${spec.label.toLowerCase()}`
								: `Choose a ${spec.label.toLowerCase()}`}
						</button>
						{#if current}
							<form method="POST" action="?/removeAsset" use:enhance>
								<input type="hidden" name="id" value={banner.id} />
								<input type="hidden" name="slot" value={key} />
								<button
									type="submit"
									class="text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)]"
								>
									Remove
								</button>
							</form>
						{/if}
					</div>
				{/each}
				{#if !banner.assets.logo}
					<span class="text-xs text-[var(--dash-text-secondary)]">
						Without a logo of its own, the theme's logo is used.
					</span>
				{/if}
			</div>

			<div class="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--dash-border)] pt-4">
				<form
					method="POST"
					action="?/draw"
					use:enhance={() => {
						drawing = banner.id;
						return async ({ update }) => {
							await update();
							drawing = null;
						};
					}}
				>
					<input type="hidden" name="id" value={banner.id} />
					<button
						type="submit"
						disabled={drawing !== null || banner.config.presetIds.length === 0}
						class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
					>
						{drawing === banner.id ? 'Drawing…' : 'Draw it at every size'}
					</button>
				</form>
				<form method="POST" action="?/delete" use:enhance>
					<input type="hidden" name="id" value={banner.id} />
					<button
						type="submit"
						class="text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)]"
					>
						Delete this template
					</button>
				</form>
			</div>

			{#if banner.drawings.length > 0}
				<ul class="mt-4 grid gap-3 sm:grid-cols-2">
					{#each banner.drawings as drawn (drawn.renditionId)}
						<li class="rounded-lg border border-[var(--dash-border)] p-2">
							<a
								href={resolve('/(app)/profile/media/[id]', { id: String(drawn.itemId) })}
								class="block"
							>
								<img
									src={`/api/media/renditions/${drawn.renditionId}`}
									alt=""
									class="w-full rounded"
								/>
								<span class="mt-1 block text-xs text-[var(--dash-text-secondary)]">
									{presetLabel(drawn.presetId)}{drawn.date
										? `, drawn ${drawn.date.slice(0, 10)}`
										: ''}
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</Card>
	{/each}

	<Card padding="lg">
		<form
			method="POST"
			action="?/create"
			use:enhance
			class="flex flex-wrap items-end gap-3 text-sm"
		>
			<label class="min-w-[12rem] flex-1">
				<span class="mb-1 block font-medium text-[var(--dash-text)]">New banner template</span>
				<input
					name="name"
					placeholder="LinkedIn and X banner"
					class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
				/>
			</label>
			<button
				type="submit"
				class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 font-medium text-white hover:opacity-90"
			>
				Add
			</button>
		</form>
	</Card>
</div>

{#if pickerFor}
	{@const target = pickerFor}
	<MediaPicker
		title={BANNER_MEDIA_SLOTS[target.slot].label}
		kind={BANNER_MEDIA_SLOTS[target.slot].kind}
		onpick={(itemId, crop) => pickAsset(target.id, target.slot, itemId, crop)}
		onclose={() => (pickerFor = null)}
	/>
{/if}
