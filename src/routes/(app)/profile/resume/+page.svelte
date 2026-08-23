<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { assetUrl, DEFAULT_TEMPLATE_ID } from '$lib/resume-templates';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCheckCircle,
		faCog,
		faFileAlt,
		faFilePdf,
		faGlobe,
		faPencil,
		faSync
	} from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../components/SectionHeader.svelte';
	import EmptyState from '../components/EmptyState.svelte';
	import ItemCard from '../components/ItemCard.svelte';
	import { profileDocUrl } from '$lib/utils/profile-doc-url';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let versions = $derived(data.versions);
	let publicResumeVersionId = $derived(data.publicResumeVersionId);
	let publicCvVersionId = $derived(data.publicCvVersionId);
	let selectedTemplate = $derived(data.selectedTemplate);
	// The built-in "Standard" template plus this profile's DB-backed templates.
	let templateTiles = $derived([
		{
			id: DEFAULT_TEMPLATE_ID,
			label: 'Standard',
			description: 'Clean single-column layout',
			thumb: null as string | null
		},
		...data.templates.map((t) => ({
			id: t.slug,
			label: t.name,
			description: '',
			thumb: assetUrl(t.config?.thumbnail)
		}))
	]);
	let templateLabel = $derived(templateTiles.find((t) => t.id === selectedTemplate)?.label ?? '');

	// Template is a page-level lens persisted in ?template=; changing it re-runs
	// the loader (per-template "has PDF" state) and re-lenses every doc link.
	function selectTemplate(id: string) {
		const u = new URL(page.url);
		if (id === DEFAULT_TEMPLATE_ID) u.searchParams.delete('template');
		else u.searchParams.set('template', id);
		goto(u.pathname + u.search, {
			keepFocus: true,
			noScroll: true,
			invalidateAll: true
		});
	}

	// Language is a second page-level lens (?lang=), only shown when the profile
	// has translations. Mirrors selectTemplate.
	let selectedLocale = $derived(data.selectedLocale);
	let availableLocales = $derived(data.availableLocales);
	let localeLabel = $derived(
		selectedLocale === 'en'
			? ''
			: ` · ${
					availableLocales.find((l) => l.code === selectedLocale)?.nativeLabel ?? selectedLocale
				}`
	);
	function selectLocale(code: string) {
		const u = new URL(page.url);
		if (code === 'en') u.searchParams.delete('lang');
		else u.searchParams.set('lang', code);
		goto(u.pathname + u.search, {
			keepFocus: true,
			noScroll: true,
			invalidateAll: true
		});
	}

	let showAddForm = $state(false);
	let showAddAdvanced = $state(false);
	let generatingSlug = $state<string | null>(null);
	let generatedSlug = $state<string | null>(null);

	// Form states for new entry
	let newName = $state('');
	let newSlug = $state('');
	let newSlugManual = $state(false);
	let newExtendsIds = $state<number[]>([]);

	function slugify(text: string): string {
		return text
			.toLowerCase()
			.trim()
			.replace(/[^\w\s-]/g, '')
			.replace(/[\s_]+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

	function handleNewNameInput() {
		if (!newSlugManual) {
			newSlug = slugify(newName);
		}
	}

	function handleNewSlugInput() {
		newSlugManual = true;
	}

	function formatDate(date: Date | string | null): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function resetAddForm() {
		showAddForm = false;
		showAddAdvanced = false;
		newName = '';
		newSlug = '';
		newSlugManual = false;
		newExtendsIds = [];
	}

	function handleAddSubmit() {
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			await update();
			if (result.type === 'success') {
				resetAddForm();
			}
		};
	}

	function handleGenerateSubmit(slug: string) {
		generatingSlug = slug;
		return async ({ result }: { result: { type: string }; update: () => Promise<void> }) => {
			generatingSlug = null;
			if (result.type === 'success') {
				generatedSlug = slug;
			}
		};
	}

	function isPublicResume(versionId: number): boolean {
		return publicResumeVersionId === versionId;
	}

	function isPublicCv(versionId: number): boolean {
		return publicCvVersionId === versionId;
	}

	function getDisplayName(version: (typeof versions)[0]): string {
		return version.name || version.slug || 'Untitled Version';
	}
</script>

<svelte:head>
	<title>Resumes & CVs - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader
		title="Resumes & CVs"
		icon={faFileAlt}
		showAddButton={!showAddForm && versions.length > 0}
		addLabel="Add Version"
		onAdd={() => (showAddForm = true)}
	/>

	<p class="text-sm text-[var(--dash-text-secondary)]">
		A version decides which parts of your profile a document prints — it is not a separate copy.
		<a
			href={resolve('/guide/[slug]', { slug: 'resumes-and-cvs' })}
			class="text-[var(--dash-primary)] hover:underline">How versions work</a
		>.
	</p>

	<!-- Language switcher: re-lenses every doc link + the generate button.
       Shown only when the profile has translations in another language. -->
	{#if versions.length > 0 && availableLocales.length > 1}
		<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4">
			<p class="mb-3 text-sm font-medium text-[var(--dash-text)]">Language</p>
			<div class="flex flex-wrap gap-2">
				{#each availableLocales as l (l.code)}
					{@const active = selectedLocale === l.code}
					<button
						type="button"
						onclick={() => selectLocale(l.code)}
						aria-pressed={active}
						class="cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors {active
							? 'border-transparent bg-[var(--dash-primary)] text-white'
							: 'border-[var(--dash-border)] bg-[var(--dash-card)] text-[var(--dash-text)] hover:border-[var(--dash-primary)]'}"
					>
						{l.nativeLabel}
					</button>
				{/each}
			</div>
			<p class="mt-2 text-xs text-[var(--dash-text-muted)]">
				Preview, download and generate PDFs in the selected language. Untranslated fields fall back
				to English.
			</p>
		</div>
	{/if}

	<!-- Template switcher: re-lenses every doc link + the generate button.
       Shown only when the profile has custom (DB-backed) templates. -->
	{#if versions.length > 0 && data.templates.length > 0}
		<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4">
			<p class="mb-3 text-sm font-medium text-[var(--dash-text)]">Template</p>
			<div class="flex flex-wrap gap-3">
				{#each templateTiles as t (t.id)}
					{@const active = selectedTemplate === t.id}
					<button
						type="button"
						onclick={() => selectTemplate(t.id)}
						aria-pressed={active}
						class="cursor-pointer rounded-lg border-2 p-1.5 text-left transition-colors {active
							? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5'
							: 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/50'}"
					>
						{#if t.thumb}
							<img
								src={t.thumb}
								alt="{t.label} template preview"
								class="h-40 w-28 rounded border border-[var(--dash-border)] bg-white object-cover object-top"
							/>
						{:else}
							<div
								class="flex h-40 w-28 items-center justify-center rounded border border-[var(--dash-border)] bg-white"
							>
								<FontAwesomeIcon icon={faFileAlt} class="h-8 w-8 text-[var(--dash-text-muted)]" />
							</div>
						{/if}
						<div class="mt-1.5 px-0.5">
							<div class="flex items-center gap-1.5 text-sm font-medium text-[var(--dash-text)]">
								{t.label}
								{#if active}
									<FontAwesomeIcon
										icon={faCheckCircle}
										class="h-3 w-3 text-[var(--dash-primary)]"
									/>
								{/if}
							</div>
							{#if t.description}
								<div class="text-xs text-[var(--dash-text-muted)]">
									{t.description}
								</div>
							{/if}
						</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if form?.error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
		</div>
	{/if}

	<!-- Add Form -->
	{#if showAddForm}
		<form
			method="POST"
			action="?/create"
			use:enhance={handleAddSubmit}
			class="rounded-lg border border-[var(--dash-primary)] bg-[var(--dash-card)] p-4"
		>
			<h3 class="mb-4 font-medium text-[var(--dash-text)]">Add New Version</h3>
			<div class="space-y-4">
				<div>
					<label for="new-name" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						Name
					</label>
					<input
						type="text"
						id="new-name"
						name="name"
						bind:value={newName}
						oninput={handleNewNameInput}
						placeholder="e.g., Full Stack Developer Resume"
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<!-- Hidden slug field (auto-generated from name) -->
				<input type="hidden" name="slug" value={newSlug} />

				<!-- Advanced toggle -->
				<button
					type="button"
					onclick={() => (showAddAdvanced = !showAddAdvanced)}
					class="text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
				>
					{showAddAdvanced ? 'Hide' : 'Show'} advanced options
				</button>

				{#if showAddAdvanced}
					<div class="space-y-4 border-t border-[var(--dash-border)] pt-4">
						<div>
							<label for="new-slug" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
								Slug
							</label>
							<input
								type="text"
								id="new-slug"
								bind:value={newSlug}
								oninput={handleNewSlugInput}
								placeholder="e.g., fullstack-developer"
								pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
								class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
							/>
							<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
								Auto-generated from name. Used in URLs and version tags.
							</p>
						</div>

						{#if versions.length > 0}
							<div>
								<p class="mb-2 block text-sm font-medium text-[var(--dash-text)]">Extends</p>
								<div class="flex flex-wrap gap-x-4 gap-y-2">
									{#each versions as v}
										<label
											class="flex cursor-pointer items-center gap-1.5 text-sm text-[var(--dash-text)]"
										>
											<input
												type="checkbox"
												name="extendsIds"
												value={v.id}
												checked={newExtendsIds.includes(v.id)}
												onchange={(e) => {
													if (e.currentTarget.checked) {
														newExtendsIds = [...newExtendsIds, v.id];
													} else {
														newExtendsIds = newExtendsIds.filter((id) => id !== v.id);
													}
												}}
												class="rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
											/>
											{v.name || v.slug || 'Untitled'}
										</label>
									{/each}
								</div>
								<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
									Inherit tags and toggles from other versions
								</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="mt-4 flex justify-end gap-2">
				<button
					type="button"
					onclick={resetAddForm}
					class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>
					Cancel
				</button>
				<button
					type="submit"
					class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
				>
					Add Version
				</button>
			</div>
		</form>
	{/if}

	<!-- Versions List -->
	{#if versions.length === 0 && !showAddForm}
		<EmptyState
			icon={faFileAlt}
			title="No resume versions yet"
			description="Create different versions of your resume for different job types or industries. Each version can be customized and exported."
			actionLabel="Add First Version"
			onAction={() => (showAddForm = true)}
		/>
	{:else}
		<div class="space-y-3">
			{#each versions as version (version.id)}
				<ItemCard id={version.id} icon={faFileAlt} iconColor="text-indigo-600">
					{#snippet title()}
						{getDisplayName(version)}
					{/snippet}

					{#snippet badges()}
						{#if isPublicResume(version.id)}
							<span
								class="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--dash-info-light)] px-2 py-0.5 align-middle text-xs text-[var(--dash-info)]"
							>
								<FontAwesomeIcon icon={faGlobe} class="h-3 w-3" />
								Public Resume
							</span>
						{/if}
						{#if isPublicCv(version.id)}
							<span
								class="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--dash-info-light)] px-2 py-0.5 align-middle text-xs text-[var(--dash-info)]"
							>
								<FontAwesomeIcon icon={faGlobe} class="h-3 w-3" />
								Public CV
							</span>
						{/if}
					{/snippet}

					{#snippet subtitle()}
						{#if version.date_created}
							Created {formatDate(version.date_created)}
						{/if}
					{/snippet}

					{#snippet dateline()}
						{#if data.selectedProfile?.slug}
							{@const ps = data.selectedProfile.slug}
							{@const vs = version.slug ?? ''}
							<div class="space-y-3">
								<div class="flex gap-3">
									<div class="rounded-lg border border-[var(--dash-border)] px-4 py-3 text-center">
										<p class="mb-2 text-sm font-semibold text-[var(--dash-text)]">Resume</p>
										<div class="flex items-center justify-center gap-1.5">
											<a
												href={profileDocUrl({
													profileSlug: ps,
													docType: 'resume',
													versionSlug: vs,
													isPublicVersion: isPublicResume(version.id),
													template: selectedTemplate,
													locale: selectedLocale
												})}
												target="_blank"
												class="dash-link-ext">HTML</a
											>
											<a
												href={profileDocUrl({
													profileSlug: ps,
													docType: 'resume',
													versionSlug: vs,
													isPublicVersion: isPublicResume(version.id),
													pdf: true,
													template: selectedTemplate,
													locale: selectedLocale
												})}
												target="_blank"
												class="dash-link-ext">PDF</a
											>
										</div>
									</div>
									<div class="rounded-lg border border-[var(--dash-border)] px-4 py-3 text-center">
										<p class="mb-2 text-sm font-semibold text-[var(--dash-text)]">CV</p>
										<div class="flex items-center justify-center gap-1.5">
											<a
												href={profileDocUrl({
													profileSlug: ps,
													docType: 'cv',
													versionSlug: vs,
													isPublicVersion: isPublicCv(version.id),
													template: selectedTemplate,
													locale: selectedLocale
												})}
												target="_blank"
												class="dash-link-ext">HTML</a
											>
											<a
												href={profileDocUrl({
													profileSlug: ps,
													docType: 'cv',
													versionSlug: vs,
													isPublicVersion: isPublicCv(version.id),
													pdf: true,
													template: selectedTemplate,
													locale: selectedLocale
												})}
												target="_blank"
												class="dash-link-ext">PDF</a
											>
										</div>
									</div>
								</div>
								{#if generatingSlug === version.slug}
									<span class="dash-link-ext pointer-events-none !bg-amber-500/10 !text-amber-600">
										<FontAwesomeIcon icon={faCog} class="h-3 w-3 animate-spin" />
										Generating...
									</span>
								{:else if generatedSlug === version.slug}
									<span class="dash-link-ext pointer-events-none !bg-green-500/10 !text-green-600">
										<FontAwesomeIcon icon={faCheckCircle} class="h-3 w-3" />
										PDFs generated
									</span>
								{:else}
									{@const hasPdfs = version.hasResumePdf && version.hasCvPdf}
									<form
										method="POST"
										action="?/generateExports"
										use:enhance={() => handleGenerateSubmit(version.slug ?? '')}
										class="inline"
									>
										<input type="hidden" name="slug" value={version.slug} />
										<input type="hidden" name="template" value={selectedTemplate} />
										<input type="hidden" name="locale" value={selectedLocale} />
										<button
											type="submit"
											class="dash-link-ext border border-[var(--dash-border)] {hasPdfs
												? '!bg-[var(--dash-bg)] !text-[var(--dash-text-secondary)] hover:!bg-[var(--dash-primary)]/10 hover:!text-[var(--dash-primary)]'
												: '!bg-amber-500/10 !text-amber-600 hover:!bg-amber-500/20'}"
										>
											<FontAwesomeIcon icon={hasPdfs ? faSync : faFilePdf} class="h-3 w-3" />
											{hasPdfs
												? `Regenerate ${templateLabel} PDFs`
												: `Generate ${templateLabel} PDFs`}{localeLabel}
										</button>
									</form>
								{/if}
							</div>
						{/if}
					{/snippet}

					{#snippet headerActions()}
						<a
							href="/profile/resume/{version.id}"
							class="cursor-pointer p-1.5 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
							aria-label="Edit"
							onclick={(e) => e.stopPropagation()}
						>
							<FontAwesomeIcon icon={faPencil} class="h-4 w-4" />
						</a>
					{/snippet}
				</ItemCard>
			{/each}
		</div>
	{/if}
</div>
