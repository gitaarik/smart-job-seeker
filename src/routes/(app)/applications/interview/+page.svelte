<script lang="ts">
	import type { PageData } from './$types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowsUpDown,
		faBook,
		faChevronRight,
		faCircleNotch,
		faFileAlt,
		faGripVertical,
		faLayerGroup,
		faPencil,
		faPlus,
		faStickyNote,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import { dragHandleZone, dragHandle } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import Card from '../../components/Card.svelte';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import EmptyState from '../../profile/components/EmptyState.svelte';
	import ConfirmModal from '../../profile/components/ConfirmModal.svelte';
	import FilterTabs from '../../components/FilterTabs.svelte';
	import { renderSafeMarkdown } from '$lib/utils/safe-markdown';
	import { htmlToMarkdown } from '$lib/utils/html-to-markdown';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { data }: { data: PageData } = $props();

	let cheatsheets = $derived(data.cheatsheets);
	let stories = $derived(data.stories);

	// Filter state
	let currentType = $state('all');
	const typeFilters = [
		{ value: 'all', label: 'All', icon: faLayerGroup },
		{ value: 'cheatsheets', label: 'Interview Cheat Sheets', icon: faStickyNote },
		{ value: 'stories', label: 'Project Stories', icon: faBook }
	];

	// Shared state
	let expandedKey = $state<string | null>(null);
	let showAddMenu = $state(false);

	// Delete state
	let deleteKey = $state<string | null>(null);
	let deleteType = $state<'cheatsheet' | 'story'>('cheatsheet');

	// Save + error state (used by the add / delete flows)
	type SaveState = 'idle' | 'saving' | 'saved' | 'error';
	let addSaveState = $state<SaveState>('idle');
	let errorMessage = $state('');

	const categories = [
		{ value: 'leadership', label: 'Leadership' },
		{ value: 'problem_solving', label: 'Problem Solving' },
		{ value: 'teamwork', label: 'Teamwork' },
		{ value: 'technical', label: 'Technical Challenge' },
		{ value: 'conflict', label: 'Conflict Resolution' },
		{ value: 'innovation', label: 'Innovation' },
		{ value: 'failure', label: 'Learning from Failure' },
		{ value: 'achievement', label: 'Achievement' }
	];

	// Combined filtered list
	type CheatSheetItem = (typeof cheatsheets)[0] & { itemType: 'cheatsheet'; key: string };
	type StoryItem = (typeof stories)[0] & { itemType: 'story'; key: string };
	type Item = CheatSheetItem | StoryItem;

	let filteredItems = $derived.by(() => {
		const sheets: Item[] = cheatsheets.map((s) => ({
			...s,
			itemType: 'cheatsheet' as const,
			key: `cs-${s.id}`
		}));
		const storyItems: Item[] = stories.map((s) => ({
			...s,
			itemType: 'story' as const,
			key: `st-${s.id}`
		}));

		if (currentType === 'cheatsheets') return sheets;
		if (currentType === 'stories') return storyItems;
		return [...sheets, ...storyItems];
	});

	let hasAnyItems = $derived(cheatsheets.length > 0 || stories.length > 0);

	// Stories and cheat sheets both open in their own unified editor now, so the
	// list only expands/collapses a card's read-only preview.
	function toggleExpand(key: string) {
		expandedKey = expandedKey === key ? null : key;
	}

	// --- Cheat sheet CRUD ---
	// Cheat sheets are authored in the unified conversational editor (manual
	// content + AI in one place). Adding creates a placeholder row and opens it.
	let creatingSheet = $state(false);
	async function addCheatSheet() {
		if (creatingSheet) return;
		creatingSheet = true;
		errorMessage = '';
		try {
			const response = await fetch('/api/cheat-sheets', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					profile_id: data.profileId,
					title: 'New cheat sheet',
					content: ''
				})
			});
			const result = await response.json();
			if (response.ok && result.sheet?.id) {
				await goto(`/applications/interview/cheatsheets/${result.sheet.id}`);
			} else {
				errorMessage = result.message || result.error || "Couldn't start a cheat sheet";
				addSaveState = 'error';
				setTimeout(() => (addSaveState = 'idle'), 2000);
			}
		} catch {
			errorMessage = "Couldn't start a cheat sheet";
			addSaveState = 'error';
			setTimeout(() => (addSaveState = 'idle'), 2000);
		} finally {
			creatingSheet = false;
		}
	}

	async function deleteSheet(id: number) {
		try {
			const response = await fetch('/api/cheat-sheets', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ profile_id: data.profileId, id })
			});
			if (!response.ok) {
				const err = await response.json();
				errorMessage = err.message || err.error || 'Failed to delete cheat sheet';
				return;
			}
			await invalidateAll();
			deleteKey = null;
		} catch {
			errorMessage = 'Failed to delete cheat sheet';
		}
	}

	// --- Story CRUD ---
	// Stories are authored in the unified editor (manual STAR fields + AI in one
	// place). Adding creates a placeholder row and opens it; editing opens it too.
	let creatingStory = $state(false);
	async function addStory() {
		if (creatingStory) return;
		creatingStory = true;
		errorMessage = '';
		try {
			const response = await fetch('/api/interview-stories', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ profile_id: data.profileId, title: 'New story' })
			});
			const result = await response.json();
			if (response.ok && result.story?.id) {
				await goto(`/applications/interview/stories/${result.story.id}`);
			} else {
				errorMessage = result.message || result.error || "Couldn't start a story";
				addSaveState = 'error';
				setTimeout(() => (addSaveState = 'idle'), 2000);
			}
		} catch {
			errorMessage = "Couldn't start a story";
			addSaveState = 'error';
			setTimeout(() => (addSaveState = 'idle'), 2000);
		} finally {
			creatingStory = false;
		}
	}

	async function deleteStory(id: number) {
		try {
			const response = await fetch('/api/interview-stories', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ profile_id: data.profileId, id })
			});
			if (!response.ok) {
				const err = await response.json();
				errorMessage = err.message || err.error || 'Failed to delete story';
				return;
			}
			await invalidateAll();
			deleteKey = null;
		} catch {
			errorMessage = 'Failed to delete story';
		}
	}

	// Shared helpers
	function handleDelete() {
		if (!deleteKey) return;
		if (deleteType === 'cheatsheet') {
			const id = parseInt(deleteKey.replace('cs-', ''));
			deleteSheet(id);
		} else {
			const id = parseInt(deleteKey.replace('st-', ''));
			deleteStory(id);
		}
	}

	function getCategoryLabel(value: string | null): string {
		if (!value) return '';
		const category = categories.find((c) => c.value === value);
		return category?.label || value;
	}

	// --- Reorder mode ---
	let reorderMode = $state(false);
	let reorderSaving = $state(false);
	interface DndItem {
		id: string;
		item: Item;
		[key: string]: unknown;
	}
	let dndItems = $state<DndItem[]>([]);
	let reorderSnapshot = $state<Item[] | null>(null);
	const flipDurationMs = 150;

	// Determine the effective reorder type: when only one type exists, use it
	// even if the filter is on "all" (since filter tabs are hidden in that case)
	let reorderType = $derived.by(() => {
		if (currentType !== 'all') return currentType;
		const hasSheets = cheatsheets.length > 0;
		const hasStories = stories.length > 0;
		if (hasSheets && !hasStories) return 'cheatsheets';
		if (hasStories && !hasSheets) return 'stories';
		return 'all';
	});

	let canReorder = $derived(
		(reorderType === 'cheatsheets' && cheatsheets.length > 1) ||
			(reorderType === 'stories' && stories.length > 1)
	);

	function startReorder() {
		// Use the resolved type so reorder works when only one type exists
		const items =
			reorderType === 'cheatsheets'
				? cheatsheets.map((s) => ({ ...s, itemType: 'cheatsheet' as const, key: `cs-${s.id}` }))
				: stories.map((s) => ({ ...s, itemType: 'story' as const, key: `st-${s.id}` }));
		reorderSnapshot = [...items];
		dndItems = items.map((item) => ({
			id: String(item.id),
			item
		}));
		reorderMode = true;
	}

	function handleDndConsider(e: CustomEvent<{ items: DndItem[] }>) {
		dndItems = e.detail.items;
	}

	function handleDndFinalize(e: CustomEvent<{ items: DndItem[] }>) {
		dndItems = e.detail.items;
	}

	async function confirmReorder() {
		reorderSaving = true;
		const ids = dndItems.map((d) => parseInt(d.id)).filter((id) => !isNaN(id));
		const endpoint = reorderType === 'cheatsheets' ? '/api/cheat-sheets' : '/api/interview-stories';
		try {
			await fetch(endpoint, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ profile_id: data.profileId, order: ids })
			});
			await invalidateAll();
		} catch {
			// silently fail
		}
		reorderSaving = false;
		reorderSnapshot = null;
		reorderMode = false;
	}

	function cancelReorder() {
		reorderSnapshot = null;
		reorderMode = false;
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('[data-add-menu]')) {
			showAddMenu = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<svelte:head>
	<title>Interview Prep - Smart Job Seeker</title>
</svelte:head>

<!-- Shared Add menu (header + empty state); the [data-add-menu] wrapper keeps
     handleClickOutside from closing the menu on the same click that opens it -->
{#snippet addMenu()}
	<div class="relative" data-add-menu>
		<button
			type="button"
			onclick={() => (showAddMenu = !showAddMenu)}
			class="flex items-center justify-center gap-2 rounded-lg bg-[var(--dash-primary)] p-3 text-white transition-colors hover:bg-[var(--dash-primary-hover)] sm:px-4 sm:py-2"
		>
			<FontAwesomeIcon icon={faPlus} class="h-5 w-5 sm:h-4 sm:w-4" />
			<span class="hidden sm:inline">Add</span>
		</button>
		{#if showAddMenu}
			<div
				class="absolute top-full right-0 z-20 mt-1 min-w-[220px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
			>
				<button
					type="button"
					onclick={() => {
						showAddMenu = false;
						addStory();
					}}
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>
					<FontAwesomeIcon icon={faBook} class="h-3.5 w-3.5 opacity-50" />
					Project Story
				</button>
				<button
					type="button"
					onclick={() => {
						showAddMenu = false;
						addCheatSheet();
					}}
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>
					<FontAwesomeIcon icon={faStickyNote} class="h-3.5 w-3.5 opacity-50" />
					Interview Cheat Sheet
				</button>
			</div>
		{/if}
	</div>
{/snippet}

<div class="space-y-6">
	<!-- Header with title and add button -->
	<div class="flex items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			<FontAwesomeIcon icon={faBook} class="h-7 w-7 text-[var(--dash-primary)]" />
			<h2 class="text-2xl font-bold text-[var(--dash-text)]">Interview Prep</h2>
		</div>
		{#if hasAnyItems}
			{@render addMenu()}
		{/if}
	</div>

	<p class="text-sm text-[var(--dash-text-secondary)]">
		Stories and cheat sheets belong to your profile, so they are ready for every interview, not just
		this one.
		<a
			href={resolve('/guide/[slug]', { slug: 'interview-prep' })}
			class="text-[var(--dash-primary)] hover:underline">Read the guide</a
		>.
	</p>

	<!-- Filter tabs -->
	{#if cheatsheets.length > 0 && stories.length > 0}
		<FilterTabs
			filters={typeFilters}
			value={currentType}
			onchange={(v) => {
				currentType = v;
				if (reorderMode) cancelReorder();
			}}
		/>
	{/if}

	{#if canReorder && !reorderMode}
		<div class="flex justify-end">
			<button
				type="button"
				onclick={startReorder}
				class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs font-medium text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)]"
			>
				<FontAwesomeIcon icon={faArrowsUpDown} class="h-3 w-3" />
				Reorder
			</button>
		</div>
	{/if}

	{#if errorMessage && addSaveState === 'error'}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{errorMessage}</p>
		</div>
	{/if}

	<!-- Items List -->
	{#if !hasAnyItems}
		<div class="flex flex-col items-center gap-4">
			<EmptyState
				icon={faBook}
				title="No interview prep materials yet"
				description="Create cheat sheets for quick reference or project stories using the STAR method to prepare for behavioral interview questions."
			/>
			{@render addMenu()}
		</div>
	{:else if reorderMode}
		<!-- Reorder Mode -->
		{#snippet reorderConfirmCancel()}
			<div class="flex items-center justify-end gap-2">
				<span class="text-xs text-[var(--dash-text-muted)]"
					>Reorder {reorderType === 'cheatsheets' ? 'Interview Cheat Sheets' : 'Stories'}</span
				>
				<button
					type="button"
					onclick={cancelReorder}
					class="rounded-lg border border-[var(--dash-border)] px-3 py-1 text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={confirmReorder}
					disabled={reorderSaving}
					class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--dash-success)] px-3 py-1 text-xs text-white transition-colors hover:opacity-90 disabled:opacity-70"
				>
					{#if reorderSaving}<FontAwesomeIcon icon={faCircleNotch} spin class="h-3 w-3" />{/if}
					Save
				</button>
			</div>
		{/snippet}

		{@render reorderConfirmCancel()}
		<div
			class="mt-2 space-y-2"
			use:dragHandleZone={{ items: dndItems, flipDurationMs, type: 'interview-items' }}
			onconsider={handleDndConsider}
			onfinalize={handleDndFinalize}
		>
			{#each dndItems as dndItem (dndItem.id)}
				<div animate:flip={{ duration: flipDurationMs }}>
					<Card class="p-3 sm:p-4">
						<div class="flex items-center gap-3">
							<div use:dragHandle class="-m-1 cursor-grab touch-none p-1 active:cursor-grabbing">
								<FontAwesomeIcon
									icon={faGripVertical}
									class="h-4 w-4 flex-shrink-0 text-[var(--dash-text-muted)]"
								/>
							</div>
							<FontAwesomeIcon
								icon={dndItem.item.itemType === 'cheatsheet' ? faStickyNote : faBook}
								class="h-4 w-4 {dndItem.item.itemType === 'cheatsheet'
									? 'text-purple-600'
									: 'text-blue-600'} flex-shrink-0"
							/>
							<h3 class="truncate text-base font-semibold text-[var(--dash-text)]">
								{dndItem.item.title || 'Untitled'}
							</h3>
							<span class="flex-shrink-0 text-xs text-[var(--dash-text-muted)]">
								{dndItem.item.itemType === 'cheatsheet' ? 'Interview Cheat Sheet' : 'Story'}
							</span>
						</div>
					</Card>
				</div>
			{/each}
		</div>
		<div class="mt-2">
			{@render reorderConfirmCancel()}
		</div>
	{:else}
		<div class="space-y-3">
			{#each filteredItems as item (item.key)}
				{#if item.itemType === 'cheatsheet'}
					<!-- Cheat Sheet Card -->
					{@const sheet = item}
					{@const isExpanded = expandedKey === item.key}
					<Card class="relative overflow-hidden transition-all">
						<button
							type="button"
							onclick={(e) => {
								e.stopPropagation();
								toggleExpand(item.key);
							}}
							class="absolute top-3 right-3 z-10 p-1.5 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
							aria-label={isExpanded ? 'Collapse' : 'Expand'}
						>
							<span
								class="inline-block transition-transform duration-200 {isExpanded
									? 'rotate-90'
									: ''}"
							>
								<FontAwesomeIcon icon={faChevronRight} class="h-4 w-4" />
							</span>
						</button>

						<button
							type="button"
							onclick={() => toggleExpand(item.key)}
							class="w-full cursor-pointer p-3 text-left transition-colors hover:bg-[var(--dash-bg)] sm:p-4"
						>
							<div class="flex items-start gap-3">
								<div class="hidden flex-shrink-0 md:flex">
									<div
										class="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dash-bg)]"
									>
										<FontAwesomeIcon icon={faStickyNote} class="h-6 w-6 text-purple-600" />
									</div>
								</div>
								<div class="min-w-0 flex-1">
									<h3
										class="line-clamp-2 pr-14 text-sm font-medium text-[var(--dash-text)] sm:truncate sm:text-base"
									>
										{sheet.title || 'Untitled'}
									</h3>
									<span class="text-xs text-[var(--dash-text-muted)]">Interview Cheat Sheet</span>
								</div>
								<div class="flex flex-shrink-0 flex-col items-end md:hidden">
									<div class="mb-1 h-6"></div>
									<div
										class="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dash-bg)]"
									>
										<FontAwesomeIcon icon={faStickyNote} class="h-6 w-6 text-purple-600" />
									</div>
								</div>
							</div>
						</button>

						<a
							href="/applications/interview/cheatsheets/{sheet.id}"
							onclick={(e) => e.stopPropagation()}
							class="absolute top-3 right-10 z-10 cursor-pointer p-1.5 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
							aria-label="Edit cheat sheet"
						>
							<FontAwesomeIcon icon={faPencil} class="h-4 w-4" />
						</a>

						{#if isExpanded}
							<div class="border-t border-[var(--dash-border)] p-3 sm:p-4">
								{#if sheet.content}
									<div class="cheatsheet-content text-sm text-[var(--dash-text)]">
										{@html renderSafeMarkdown(htmlToMarkdown(sheet.content))}
									</div>
								{:else}
									<p class="text-sm text-[var(--dash-text-secondary)] italic">
										Nothing written yet — open the editor to draft it yourself or with AI.
									</p>
								{/if}
								<div class="mt-4 flex items-center border-t border-[var(--dash-border)]/50 pt-3">
									<button
										type="button"
										onclick={() => {
											deleteKey = item.key;
											deleteType = 'cheatsheet';
										}}
										class="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500 transition-colors hover:border-red-500/50 hover:bg-red-500/20"
									>
										<FontAwesomeIcon icon={faTrash} class="h-3 w-3" /> Delete
									</button>
									<a
										href="/applications/interview/cheatsheets/{sheet.id}"
										class="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-primary)] px-3 py-1.5 text-xs text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-primary-light)]"
									>
										<FontAwesomeIcon icon={faPencil} class="h-3 w-3" /> Edit cheat sheet
									</a>
								</div>
							</div>
						{/if}
					</Card>
				{:else}
					<!-- Story Card -->
					{@const story = item}
					{@const isExpanded = expandedKey === item.key}
					<Card class="relative overflow-hidden transition-all">
						<button
							type="button"
							onclick={(e) => {
								e.stopPropagation();
								toggleExpand(item.key);
							}}
							class="absolute top-3 right-3 z-10 p-1.5 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
							aria-label={isExpanded ? 'Collapse' : 'Expand'}
						>
							<span
								class="inline-block transition-transform duration-200 {isExpanded
									? 'rotate-90'
									: ''}"
							>
								<FontAwesomeIcon icon={faChevronRight} class="h-4 w-4" />
							</span>
						</button>

						<button
							type="button"
							onclick={() => toggleExpand(item.key)}
							class="w-full cursor-pointer p-3 text-left transition-colors hover:bg-[var(--dash-bg)] sm:p-4"
						>
							<div class="flex items-start gap-3">
								<div class="hidden flex-shrink-0 md:flex">
									<div
										class="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dash-bg)]"
									>
										<FontAwesomeIcon icon={faBook} class="h-6 w-6 text-blue-600" />
									</div>
								</div>
								<div class="min-w-0 flex-1">
									<h3
										class="line-clamp-2 pr-14 text-sm font-medium text-[var(--dash-text)] sm:truncate sm:text-base"
									>
										{story.title || 'Untitled Story'}
									</h3>
									<div
										class="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--dash-text-secondary)] sm:gap-3 sm:text-sm"
									>
										<span class="text-xs text-[var(--dash-text-muted)]">Project Story</span>
										{#if story.category}
											<span
												class="rounded-full bg-[var(--dash-info-light)] px-2 py-0.5 font-medium text-[var(--dash-info)]"
											>
												{getCategoryLabel(story.category)}
											</span>
										{/if}
									</div>
								</div>
								<div class="flex flex-shrink-0 flex-col items-end md:hidden">
									<div class="mb-1 h-6"></div>
									<div
										class="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dash-bg)]"
									>
										<FontAwesomeIcon icon={faBook} class="h-6 w-6 text-blue-600" />
									</div>
								</div>
							</div>
						</button>

						<a
							href="/applications/interview/stories/{story.id}"
							onclick={(e) => e.stopPropagation()}
							class="absolute top-3 right-10 z-10 cursor-pointer p-1.5 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
							aria-label="Edit story"
						>
							<FontAwesomeIcon icon={faPencil} class="h-4 w-4" />
						</a>

						{#if isExpanded}
							{@const hasContent = !!(
								story.situation ||
								story.task ||
								story.action ||
								story.result ||
								story.reflection
							)}
							<div class="border-t border-[var(--dash-border)] p-3 sm:p-4">
								{#if hasContent}
									<div class="space-y-3 sm:space-y-4">
										{#if story.situation}
											<div>
												<p
													class="mb-1 text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase"
												>
													Situation
												</p>
												<p class="text-sm whitespace-pre-wrap text-[var(--dash-text)]">
													{story.situation}
												</p>
											</div>
										{/if}
										{#if story.task}
											<div>
												<p
													class="mb-1 text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase"
												>
													Task
												</p>
												<p class="text-sm whitespace-pre-wrap text-[var(--dash-text)]">
													{story.task}
												</p>
											</div>
										{/if}
										{#if story.action}
											<div>
												<p
													class="mb-1 text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase"
												>
													Action
												</p>
												<p class="text-sm whitespace-pre-wrap text-[var(--dash-text)]">
													{story.action}
												</p>
											</div>
										{/if}
										{#if story.result}
											<div>
												<p
													class="mb-1 text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase"
												>
													Result
												</p>
												<p class="text-sm whitespace-pre-wrap text-[var(--dash-text)]">
													{story.result}
												</p>
											</div>
										{/if}
										{#if story.reflection}
											<div>
												<p
													class="mb-1 text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase"
												>
													Reflection
												</p>
												<p class="text-sm whitespace-pre-wrap text-[var(--dash-text)]">
													{story.reflection}
												</p>
											</div>
										{/if}
									</div>
								{:else}
									<p class="text-sm text-[var(--dash-text-secondary)] italic">
										Nothing written yet — open the editor to draft it yourself or with AI.
									</p>
								{/if}
								<div class="mt-4 flex items-center border-t border-[var(--dash-border)]/50 pt-3">
									<button
										type="button"
										onclick={() => {
											deleteKey = item.key;
											deleteType = 'story';
										}}
										class="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500 transition-colors hover:border-red-500/50 hover:bg-red-500/20"
									>
										<FontAwesomeIcon icon={faTrash} class="h-3 w-3" /> Delete
									</button>
									<a
										href="/applications/interview/stories/{story.id}"
										class="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-primary)] px-3 py-1.5 text-xs text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-primary-light)]"
									>
										<FontAwesomeIcon icon={faPencil} class="h-3 w-3" /> Edit story
									</a>
								</div>
							</div>
						{/if}
					</Card>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
	isOpen={deleteKey !== null}
	title={deleteType === 'cheatsheet' ? 'Delete Interview Cheat Sheet' : 'Delete Story'}
	message={deleteType === 'cheatsheet'
		? 'Are you sure you want to delete this interview cheat sheet? This action cannot be undone.'
		: 'Are you sure you want to delete this project story? This action cannot be undone.'}
	onCancel={() => (deleteKey = null)}
	onConfirm={handleDelete}
/>

<style>
	.cheatsheet-content :global(h1) {
		font-size: 1.5em;
		font-weight: 700;
		margin-top: 1em;
		margin-bottom: 0.5em;
	}
	.cheatsheet-content :global(h2) {
		font-size: 1.25em;
		font-weight: 600;
		margin-top: 0.85em;
		margin-bottom: 0.5em;
	}
	.cheatsheet-content :global(h3) {
		font-size: 1.1em;
		font-weight: 600;
		margin-top: 0.75em;
		margin-bottom: 0.5em;
	}
	.cheatsheet-content :global(p) {
		margin-bottom: 0.5em;
	}
	.cheatsheet-content :global(ul),
	.cheatsheet-content :global(ol) {
		margin-left: 1.25em;
		margin-bottom: 0.5em;
	}
	.cheatsheet-content :global(ul) {
		list-style-type: disc;
	}
	.cheatsheet-content :global(ol) {
		list-style-type: decimal;
	}
	.cheatsheet-content :global(li) {
		margin-bottom: 0.25em;
	}
	.cheatsheet-content :global(strong) {
		font-weight: 600;
	}
	.cheatsheet-content :global(em) {
		font-style: italic;
	}
</style>
