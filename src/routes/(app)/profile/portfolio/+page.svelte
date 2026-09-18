<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowDown,
		faArrowUp,
		faGlobe,
		faImage,
		faPalette,
		faPencil,
		faTrash,
		faTriangleExclamation,
		faXmark
	} from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../components/SectionHeader.svelte';
	import EmptyState from '../components/EmptyState.svelte';
	import ConfirmModal from '../components/ConfirmModal.svelte';
	import Card from '../../components/Card.svelte';
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import { assetUrl } from '$lib/presentation-templates';
	import { themeSections, type PortfolioSection } from '$lib/portfolio-themes';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let themes = $derived(data.themes);
	let isPublished = $derived(!!data.publishedThemeId && !!data.publishedVersionId);
	let publishedTheme = $derived(data.themes.find((t) => t.id === data.publishedThemeId));
	let publishedVersion = $derived(data.versions.find((v) => v.id === data.publishedVersionId));
	let siteUrl = $derived(`/p/${data.profileSlug}/portfolio`);

	let showAddForm = $state(false);
	let newName = $state('');
	let editingId = $state<number | null>(null);
	let renamingId = $state<number | null>(null);
	let renameValue = $state('');
	let deleteId = $state<number | null>(null);
	let deleteForm = $state<HTMLFormElement | null>(null);

	/**
	 * The editor's state while it is open.
	 *
	 * Keyed by theme so opening a second editor does not inherit the first
	 * theme's order, and seeded from the stored config through the same
	 * `themeSections` the renderer will use — an editor that disagreed with the
	 * renderer about the default would show an order the site does not have.
	 *
	 * These are the authority for what the form submits, which is why every
	 * form here suppresses the reset that `use:enhance` does by default (see
	 * `keepState`). Svelte sets `checked` and `value` as DOM *properties*, so a
	 * `form.reset()` restores the HTML defaults instead: every checkbox
	 * unticked and a colour input at #000000. That is invisible on screen for
	 * one beat and then real — the next save writes `sections: []` and a black
	 * accent over the theme the person had just saved.
	 */
	let orderDraft = $state<Record<number, PortfolioSection[]>>({});
	let enabledDraft = $state<Record<number, SvelteSet<PortfolioSection>>>({});
	let accentDraft = $state<Record<number, string>>({});

	const DEFAULT_ACCENT = '#2563eb';

	/**
	 * Submit without letting SvelteKit reset the form afterwards, and re-seed
	 * the editor from what came back so it shows what was actually stored.
	 */
	function keepState(themeId: number) {
		return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			const fresh = data.themes.find((t) => t.id === themeId);
			if (fresh && editingId === themeId) seed(fresh);
		};
	}

	const SECTION_LABELS: Record<string, string> = {
		header: 'Header',
		summary: 'Summary',
		highlights: 'Highlights',
		work: 'Work experience',
		projects: 'Projects',
		sideProjects: 'Side projects',
		skills: 'Skills',
		education: 'Education',
		certificates: 'Certificates',
		languages: 'Languages',
		references: 'References',
		about: 'About me'
	};

	const ASSET_SLOTS = [
		{ key: 'logo', label: 'Logo', hint: 'Shown in the site header.' },
		{ key: 'hero', label: 'Hero image', hint: 'Wide image behind the header.' },
		{ key: 'ogImage', label: 'Social preview', hint: 'Image used when the link is shared.' },
		{ key: 'favicon', label: 'Favicon', hint: 'The browser tab icon.' },
		{ key: 'thumbnail', label: 'Thumbnail', hint: 'Shown in this list.' }
	] as const;

	/** Load one theme's stored design into the editor's state. */
	function seed(theme: (typeof themes)[number]) {
		const order = themeSections(theme.config);
		orderDraft[theme.id] = order;
		// A theme that names its sections has opted the rest out; one that names
		// none shows them all, which is what `themeSections` already returns.
		enabledDraft[theme.id] = new SvelteSet(theme.config.sections ?? order);
		accentDraft[theme.id] = theme.config.accent ?? DEFAULT_ACCENT;
	}

	function openEditor(theme: (typeof themes)[number]) {
		if (editingId === theme.id) {
			editingId = null;
			return;
		}
		editingId = theme.id;
		seed(theme);
	}

	function move(themeId: number, index: number, delta: number) {
		const order = [...(orderDraft[themeId] ?? [])];
		const target = index + delta;
		if (target < 0 || target >= order.length) return;
		[order[index], order[target]] = [order[target], order[index]];
		orderDraft[themeId] = order;
	}

	// SvelteSet is reactive in place, so this mutates rather than reassigning —
	// a plain Set inside $state tracks neither, which is why this used to have
	// to replace the whole object to repaint a single checkbox.
	function toggle(themeId: number, section: PortfolioSection) {
		const set = enabledDraft[themeId];
		if (!set) return;
		if (set.has(section)) set.delete(section);
		else set.add(section);
	}

	function fontOf(theme: (typeof themes)[number], which: 'heading' | 'body'): string {
		return theme.config.fonts?.[which] ?? '';
	}
</script>

<svelte:head><title>Portfolio Site</title></svelte:head>

<div class="mx-auto max-w-4xl px-4 py-6">
	<SectionHeader
		title="Portfolio Site"
		icon={faGlobe}
		showAddButton={!showAddForm}
		addLabel="New Theme"
		onAdd={() => (showAddForm = true)}
	/>

	<!--
		Publishing is the two pointers, so this block is the whole of it: pick a
		theme and a version, or take it down. The URL is only shown when it
		actually resolves — the route serves 404 unless both are set.
	-->
	<Card class="mb-6">
		<div class="p-4">
			<h2 class="mb-1 flex items-center gap-2 font-medium text-[var(--dash-text)]">
				<FontAwesomeIcon icon={faGlobe} class="h-4 w-4" />
				{isPublished ? 'Your site is live' : 'Publish your site'}
			</h2>

			{#if isPublished}
				<p class="mb-3 text-sm text-[var(--dash-text-secondary)]">
					<a
						href={siteUrl}
						target="_blank"
						rel="noopener external"
						class="text-[var(--dash-primary)] underline">{siteUrl}</a
					>
					· showing <strong>{publishedTheme?.name ?? 'a theme'}</strong>
					with version <strong>{publishedVersion?.name ?? '—'}</strong>
				</p>
			{:else if themes.length === 0 || data.versions.length === 0}
				<p class="mb-3 text-sm text-[var(--dash-text-secondary)]">
					{themes.length === 0
						? 'Create a theme first — a site needs something to dress it.'
						: 'You need at least one saved profile version to publish.'}
				</p>
			{:else}
				<p class="mb-3 text-sm text-[var(--dash-text-secondary)]">
					Choose what the world sees at <code class="text-xs">{siteUrl}</code>.
				</p>
			{/if}

			{#if themes.length > 0 && data.versions.length > 0}
				<form
					method="POST"
					action="?/publish"
					use:enhance
					class="flex flex-col gap-3 sm:flex-row sm:items-end"
				>
					<label class="flex-1">
						<span class="mb-1 block text-sm font-medium text-[var(--dash-text)]">Theme</span>
						<select
							name="themeId"
							class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
						>
							{#each themes as t (t.id)}
								<option value={t.id} selected={t.id === data.publishedThemeId}>{t.name}</option>
							{/each}
						</select>
					</label>
					<label class="flex-1">
						<span class="mb-1 block text-sm font-medium text-[var(--dash-text)]">Version</span>
						<select
							name="versionId"
							class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
						>
							{#each data.versions as v (v.id)}
								<option value={v.id} selected={v.id === data.publishedVersionId}>{v.name}</option>
							{/each}
						</select>
					</label>
					<button
						type="submit"
						class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white hover:bg-[var(--dash-primary-hover)]"
					>
						{isPublished ? 'Update' : 'Publish'}
					</button>
				</form>

				{#if isPublished}
					<form method="POST" action="?/unpublish" use:enhance class="mt-3">
						<button
							type="submit"
							class="text-sm text-[var(--dash-text-secondary)] underline hover:text-red-600"
						>
							Take the site down
						</button>
					</form>
				{/if}
			{/if}
		</div>
	</Card>

	<!--
		Said once, where someone is about to publish: the site renders what the
		profile can fill, and the reflective half of a portfolio has no column
		to be written in yet.
	-->
	<div
		class="mb-6 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/40"
	>
		<FontAwesomeIcon icon={faTriangleExclamation} class="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
		<p class="text-[var(--dash-text-secondary)]">
			The site shows what your profile holds: experience, projects, skills, education, references.
			The reflective sections a portfolio usually carries — ideal company, five-year vision, what
			excites you — have nowhere in the profile to be written yet, so they are not on it.
		</p>
	</div>

	<!-- Private link: the other way out, and it belongs where links live. -->
	<p class="mb-6 text-sm text-[var(--dash-text-secondary)]">
		Want to show it to one person instead of the world? Mint a
		<a href={resolve('/profile/share')} class="text-[var(--dash-primary)] underline">share link</a>
		with the format set to Portfolio — it renders the same theme behind a token.
	</p>

	{#if form && 'error' in form && form.error}
		<div class="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
			{form.error}
		</div>
	{/if}

	{#if showAddForm}
		<Card>
			<form
				method="POST"
				action="?/create"
				use:enhance={() =>
					async ({ update }) => {
						await update();
						showAddForm = false;
						newName = '';
					}}
				class="flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
			>
				<label class="flex-1">
					<span class="mb-1 block text-sm font-medium text-[var(--dash-text)]">Theme name</span>
					<input
						name="name"
						bind:value={newName}
						required
						placeholder="e.g. Minimal"
						class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
					/>
				</label>
				<div class="flex gap-2">
					<button
						type="submit"
						class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white hover:bg-[var(--dash-primary-hover)]"
					>
						Create
					</button>
					<button
						type="button"
						onclick={() => (showAddForm = false)}
						class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text-secondary)]"
					>
						Cancel
					</button>
				</div>
			</form>
		</Card>
	{/if}

	{#if themes.length === 0 && !showAddForm}
		<EmptyState
			icon={faPalette}
			title="No portfolio themes yet"
			description="A theme holds the colours, fonts, images and section order your public site uses. Create one to start designing."
			actionLabel="New Theme"
			onAction={() => (showAddForm = true)}
		/>
	{/if}

	<div class="mt-4 flex flex-col gap-3">
		{#each themes as theme (theme.id)}
			<Card>
				<div class="flex items-start gap-4 p-4">
					{#if theme.config.thumbnail}
						<img
							src={assetUrl(theme.config.thumbnail)}
							alt=""
							class="h-16 w-16 rounded object-cover"
						/>
					{:else}
						<div
							class="flex h-16 w-16 items-center justify-center rounded"
							style:background={theme.config.accent ?? 'var(--dash-bg)'}
						>
							<FontAwesomeIcon icon={faPalette} class="h-6 w-6 text-white/80" />
						</div>
					{/if}

					<div class="min-w-0 flex-1">
						{#if renamingId === theme.id}
							<form
								method="POST"
								action="?/rename"
								use:enhance={() =>
									async ({ update }) => {
										await update();
										renamingId = null;
									}}
								class="flex gap-2"
							>
								<input type="hidden" name="themeId" value={theme.id} />
								<input
									name="name"
									bind:value={renameValue}
									required
									class="flex-1 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-[var(--dash-text)]"
								/>
								<button type="submit" class="text-sm text-[var(--dash-primary)]">Save</button>
								<button
									type="button"
									onclick={() => (renamingId = null)}
									class="text-sm text-[var(--dash-text-secondary)]">Cancel</button
								>
							</form>
						{:else}
							<h3 class="truncate font-medium text-[var(--dash-text)]">{theme.name}</h3>
							<p class="text-sm text-[var(--dash-text-secondary)]">
								<code class="text-xs">{theme.slug}</code>
								· {themeSections(theme.config).length} sections
							</p>
						{/if}
					</div>

					<div class="flex shrink-0 gap-2">
						<button
							type="button"
							title="Rename"
							onclick={() => {
								renamingId = theme.id;
								renameValue = theme.name;
							}}
							class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)]"
						>
							<FontAwesomeIcon icon={faPencil} class="h-4 w-4" />
						</button>
						<button
							type="button"
							onclick={() => openEditor(theme)}
							class="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)]"
						>
							{editingId === theme.id ? 'Close' : 'Design'}
						</button>
						<button
							type="button"
							title="Delete"
							onclick={() => (deleteId = theme.id)}
							class="p-2 text-[var(--dash-text-secondary)] hover:text-red-600"
						>
							<FontAwesomeIcon icon={faTrash} class="h-4 w-4" />
						</button>
					</div>
				</div>

				{#if editingId === theme.id}
					<div class="border-t border-[var(--dash-border)] p-4">
						<form
							method="POST"
							action="?/design"
							use:enhance={() => keepState(theme.id)}
							class="flex flex-col gap-5"
						>
							<input type="hidden" name="themeId" value={theme.id} />

							<div class="grid gap-4 sm:grid-cols-3">
								<label>
									<span class="mb-1 block text-sm font-medium text-[var(--dash-text)]">Accent</span>
									<input
										type="color"
										name="accent"
										bind:value={accentDraft[theme.id]}
										class="h-10 w-full rounded border border-[var(--dash-border)]"
									/>
								</label>
								<label>
									<span class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
										>Heading font</span
									>
									<select
										name="headingFont"
										class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
									>
										<option value="">Default</option>
										{#each data.fonts as font (font)}
											<option value={font} selected={fontOf(theme, 'heading') === font}
												>{font}</option
											>
										{/each}
									</select>
								</label>
								<label>
									<span class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
										>Body font</span
									>
									<select
										name="bodyFont"
										class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)]"
									>
										<option value="">Default</option>
										{#each data.fonts as font (font)}
											<option value={font} selected={fontOf(theme, 'body') === font}>{font}</option>
										{/each}
									</select>
								</label>
							</div>

							<fieldset>
								<legend class="mb-2 text-sm font-medium text-[var(--dash-text)]"
									>Colour scheme</legend
								>
								<div class="flex gap-4 text-sm text-[var(--dash-text-secondary)]">
									{#each [['', "Visitor's system setting"], ['light', 'Light'], ['dark', 'Dark']] as [value, label] (value)}
										<label class="flex items-center gap-2">
											<input
												type="radio"
												name="colorScheme"
												{value}
												checked={(theme.config.colorScheme ?? '') === value}
											/>
											{label}
										</label>
									{/each}
								</div>
							</fieldset>

							<fieldset>
								<legend class="mb-1 text-sm font-medium text-[var(--dash-text)]">Sections</legend>
								<p class="mb-2 text-xs text-[var(--dash-text-secondary)]">
									A section with nothing in your profile to show is skipped when the site renders,
									whether or not it is ticked here.
								</p>
								<ul class="flex flex-col gap-1">
									{#each orderDraft[theme.id] ?? [] as section, i (section)}
										<li
											class="flex items-center gap-3 rounded border border-[var(--dash-border)] px-3 py-2"
										>
											<input type="hidden" name="order" value={section} />
											<input
												type="checkbox"
												name="sections"
												value={section}
												checked={enabledDraft[theme.id]?.has(section) ?? false}
												onchange={() => toggle(theme.id, section)}
											/>
											<span class="flex-1 text-sm text-[var(--dash-text)]">
												{SECTION_LABELS[section] ?? section}
											</span>
											<button
												type="button"
												title="Move up"
												disabled={i === 0}
												onclick={() => move(theme.id, i, -1)}
												class="p-1 text-[var(--dash-text-secondary)] disabled:opacity-30"
											>
												<FontAwesomeIcon icon={faArrowUp} class="h-3 w-3" />
											</button>
											<button
												type="button"
												title="Move down"
												disabled={i === (orderDraft[theme.id]?.length ?? 0) - 1}
												onclick={() => move(theme.id, i, 1)}
												class="p-1 text-[var(--dash-text-secondary)] disabled:opacity-30"
											>
												<FontAwesomeIcon icon={faArrowDown} class="h-3 w-3" />
											</button>
										</li>
									{/each}
								</ul>
							</fieldset>

							<div>
								<button
									type="submit"
									class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white hover:bg-[var(--dash-primary-hover)]"
								>
									Save design
								</button>
							</div>
						</form>

						<!--
							Images are their own forms rather than fields on the one above:
							each is a separate row in presentation_template_assets, and a
							multipart submit that also carried the design fields would make
							"change the logo" and "change the accent" one undoable act.
						-->
						<div class="mt-6 border-t border-[var(--dash-border)] pt-4">
							<h4 class="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--dash-text)]">
								<FontAwesomeIcon icon={faImage} class="h-4 w-4" />
								Images
							</h4>
							<div class="flex flex-col gap-3">
								{#each ASSET_SLOTS as slot (slot.key)}
									{@const current =
										slot.key === 'thumbnail'
											? theme.config.thumbnail
											: theme.config.assets?.[slot.key as 'logo' | 'hero' | 'ogImage' | 'favicon']}
									<div class="flex items-center gap-3">
										{#if current}
											<img src={assetUrl(current)} alt="" class="h-10 w-10 rounded object-cover" />
										{:else}
											<div
												class="h-10 w-10 rounded border border-dashed border-[var(--dash-border)]"
											></div>
										{/if}
										<div class="min-w-0 flex-1">
											<p class="text-sm text-[var(--dash-text)]">{slot.label}</p>
											<p class="text-xs text-[var(--dash-text-secondary)]">{slot.hint}</p>
										</div>
										<form
											method="POST"
											action="?/uploadAsset"
											enctype="multipart/form-data"
											use:enhance={() => keepState(theme.id)}
											class="flex items-center gap-2"
										>
											<input type="hidden" name="themeId" value={theme.id} />
											<input type="hidden" name="slot" value={slot.key} />
											<input
												type="file"
												name="file"
												accept="image/png,image/jpeg,image/webp,image/gif"
												onchange={(e) => e.currentTarget.form?.requestSubmit()}
												class="max-w-[12rem] text-xs text-[var(--dash-text-secondary)]"
											/>
										</form>
										{#if current}
											<form
												method="POST"
												action="?/removeAsset"
												use:enhance={() => keepState(theme.id)}
											>
												<input type="hidden" name="themeId" value={theme.id} />
												<input type="hidden" name="slot" value={slot.key} />
												<button
													type="submit"
													title="Remove"
													class="p-2 text-[var(--dash-text-secondary)] hover:text-red-600"
												>
													<FontAwesomeIcon icon={faXmark} class="h-4 w-4" />
												</button>
											</form>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</Card>
		{/each}
	</div>
</div>

<!--
	The confirm dialog cannot submit by itself — it takes a callback, not a
	form — so the actual POST lives here and the dialog asks it to submit.
	Kept outside the {#each} so there is one of it rather than one per theme.
-->
<ConfirmModal
	isOpen={deleteId !== null}
	title="Delete theme"
	message={`Delete "${themes.find((t) => t.id === deleteId)?.name ?? 'this theme'}"? Its images stay in your files until the next cleanup.`}
	confirmLabel="Delete"
	onCancel={() => (deleteId = null)}
	onConfirm={() => deleteForm?.requestSubmit()}
/>
<form
	bind:this={deleteForm}
	method="POST"
	action="?/delete"
	use:enhance={() =>
		async ({ update }) => {
			await update();
			deleteId = null;
		}}
	class="hidden"
>
	<input type="hidden" name="themeId" value={deleteId ?? ''} />
</form>
