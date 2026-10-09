<script lang="ts">
	/**
	 * The technologies under one role, as chips that each save themselves.
	 *
	 * Shaped like the skills on the Skills page: a chip opens a small editor with
	 * its name, the Resume / CV / Site switches and its version tags, and a
	 * technology off every document is dimmed and marked on the chip. Before
	 * that a chip was an input with a tag button, which could pick versions but
	 * not the site, and a chip held back from the resume looked like any other.
	 *
	 * Unlike the skill editor there is no Save or Cancel: everything on this page
	 * saves as you type, so the editor writes as it goes and Done only closes it.
	 *
	 * A component of its own so the store is created at component init, which is
	 * what gives its per-chip `autoSaveField`s an `onDestroy` to deregister from.
	 * The page keys it on the role, so `workExperienceId` never changes under it.
	 */
	import { untrack } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCheck,
		faEyeSlash,
		faGripVertical,
		faPlus,
		faTags,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { clickOutside, keepInView } from '$lib/actions/popover';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import SectionSaveButton from '$lib/components/SectionSaveButton.svelte';
	import ShowOnSwitches from '$lib/components/ShowOnSwitches.svelte';
	import VersionTagPicker from '$lib/components/VersionTagPicker.svelte';
	import { sectionRows } from '$lib/components/section-rows.svelte';
	import { isHiddenFromDocuments, setShownOn, versionTagsOf } from '$lib/profile-visibility';

	let {
		workExperienceId,
		profileId,
		initial = [],
		versionSlugs = []
	}: {
		workExperienceId: number;
		profileId: number;
		initial?: Array<{ id: number; name: string | null; tags: unknown }>;
		versionSlugs?: string[];
	} = $props();
	// Links the editor's label to its field.
	const uid = $props.id();

	/**
	 * One technology as the editor holds it. `tags` is a real field, the version
	 * slugs and base templates that decide which documents it appears on, so it
	 * goes through the same PATCH as the name.
	 */
	type Technology = { name: string; tags: string[] };

	// The store starts from the props once and owns the chips from then on (see
	// above); after a proposal is applied from the chat panel the page mounts it
	// again.
	const seed = untrack(() => ({ workExperienceId, profileId, initial }));
	const store = sectionRows({
		resource: 'work_experience_technology',
		parentKey: 'work_experience_id',
		parentId: seed.workExperienceId,
		profileId: seed.profileId,
		initial: seed.initial,
		toData: (t) => ({
			name: t.name ?? '',
			tags: Array.isArray(t.tags) ? (t.tags as string[]) : []
		}),
		blank: (): Technology => ({ name: '', tags: [] }),
		toBody: (v: Technology) => ({
			name: v.name.trim(),
			tags: v.tags.length > 0 ? v.tags : null
		}),
		canCreate: (v: Technology) => v.name.trim().length > 0
	});

	type Row = (typeof store.rows)[number];

	let error = $state<string | null>(null);

	// Version badges are hidden on the chips until toggled on (like the skills page).
	let showVersionTags = $state(false);
	let hasAnyVersionTags = $derived(
		versionSlugs.length > 0 || store.rows.some((t) => versionTagsOf(t.data.tags).length > 0)
	);

	// --- The editor popup ---

	/** The chip whose editor is open, by row key; null when none is. */
	let editingKey = $state<number | null>(null);
	let editing = $derived(store.rows.find((r) => r.key === editingKey));
	/** The open editor's name field as typed, which can be blank where a row's name cannot. */
	let nameText = $state('');
	let versionsExpanded = $state(false);
	/** A chip just added, whose name field takes the focus. Read by the action only. */
	let addedKey: number | null = null;

	function open(row: Row) {
		if (reorderMode || editingKey === row.key) return;
		close();
		editingKey = row.key;
		nameText = row.data.name;
		// Open on the version tags only when there are some to see. A technology
		// held back from a document says so on the switches, not in here.
		versionsExpanded = versionTagsOf(row.data.tags).length > 0;
	}

	/**
	 * Close the editor and push its pending save out now. A chip added and never
	 * named goes with it: it was never written, so there is nothing to keep and
	 * nothing to delete.
	 */
	function close() {
		const row = editing;
		editingKey = null;
		if (!row) return;
		if (row.id === null && !row.data.name.trim()) {
			void store.remove(row);
			return;
		}
		saveNow(row);
	}

	function add() {
		const row = store.add();
		addedKey = row.key;
		open(row);
	}

	function focusIfAdded(node: HTMLInputElement, key: number) {
		if (key !== addedKey) return;
		addedKey = null;
		node.focus();
	}

	/**
	 * The name as typed. A technology that exists keeps its old name while the
	 * field is blank: the server refuses an empty one, and clearing a name to
	 * retype it should not put an error on the chip for the moment it is empty.
	 * Closing on a blank name leaves the old one.
	 */
	function rename(row: Row, value: string) {
		nameText = value;
		if (row.id !== null && !value.trim()) return;
		store.update(row, { name: value });
	}

	/**
	 * Tags are written now rather than after the debounce: a switch is a decision
	 * the moment it moves, and a version chip is a click, not a word half typed.
	 * A technology not created yet keeps them until its name arrives, and they
	 * go out with the create.
	 */
	function retag(row: Row, tags: string[]) {
		store.update(row, { tags });
		saveNow(row);
	}

	/**
	 * Send a row's pending change now, unless a save of it is still in flight.
	 *
	 * A second save sent beside the first carries the same `expected`, and the
	 * server refuses it as a conflict once the first has landed. That is two
	 * switches flipped in quick succession, or a name left for a switch, so the
	 * change waits instead: the field sends it on its own once the first returns.
	 */
	function saveNow(row: Row) {
		if (row.field.status !== 'saving') row.field.flush();
	}

	/**
	 * A chip is one word and a few switches; deleting it costs a retype, so it
	 * does not ask.
	 */
	async function remove(row: Row) {
		editingKey = null;
		error = null;
		try {
			await store.remove(row);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not delete that technology';
		}
	}

	// --- Drag-and-drop reordering (svelte-dnd-action) ---
	// Gated behind an explicit "Reorder" mode (like the skills page) so that
	// clicking a chip opens its editor until the user opts in. An order is one
	// write for the section rather than one per row, so it keeps a Save.
	const flipMs = 150;
	let reorderMode = $state(false);
	let reorderState = $state<'idle' | 'saving' | 'error'>('idle');

	interface DndItem {
		id: number;
		row: Row;
	}
	let dndItems = $state<DndItem[]>([]);

	function startReorder() {
		close();
		dndItems = store.rows.map((row) => ({ id: row.key, row }));
		reorderMode = true;
	}

	function handleConsider(e: CustomEvent<{ items: DndItem[] }>) {
		dndItems = e.detail.items;
	}

	function handleFinalize(e: CustomEvent<{ items: DndItem[] }>) {
		dndItems = e.detail.items;
	}

	function cancelReorder() {
		reorderMode = false;
		dndItems = [];
	}

	async function saveReorder() {
		reorderState = 'saving';
		error = null;
		try {
			await store.reorder(dndItems.map((d) => d.row));
			reorderState = 'idle';
			reorderMode = false;
			dndItems = [];
		} catch (e) {
			// Stay in reorder mode so the drop the user made is still on screen.
			reorderState = 'error';
			error = e instanceof Error ? e.message : 'Could not save that order';
			setTimeout(() => (reorderState = 'idle'), 3000);
		}
	}
</script>

<div class="mb-4 flex items-center justify-between">
	<div class="flex items-center gap-3">
		<h2 class="text-lg font-semibold text-[var(--dash-text)]">Technologies</h2>
		<AutoSaveIndicator field={store.summary} idleLabel="Saves as you type" />
	</div>
	<div class="flex items-center gap-1.5">
		{#if !reorderMode && hasAnyVersionTags}
			<button
				type="button"
				onclick={() => (showVersionTags = !showVersionTags)}
				class="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors {showVersionTags
					? 'border-teal-500/30 bg-teal-500/15 text-teal-700'
					: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}"
			>
				<span
					class="inline-block h-1.5 w-1.5 rounded-full transition-colors {showVersionTags
						? 'bg-teal-500'
						: 'bg-[var(--dash-text-muted)]/30'}"
				></span>
				Versions
			</button>
		{/if}
		{#if store.rows.length > 1}
			<button
				type="button"
				onclick={() => (reorderMode ? cancelReorder() : startReorder())}
				class="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors {reorderMode
					? 'border-amber-500/30 bg-amber-500/15 text-amber-700'
					: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}"
			>
				<span
					class="inline-block h-1.5 w-1.5 rounded-full transition-colors {reorderMode
						? 'bg-amber-500'
						: 'bg-[var(--dash-text-muted)]/30'}"
				></span>
				Reorder
			</button>
		{/if}
	</div>
</div>

{#if reorderMode}
	<div
		class="flex flex-wrap gap-2"
		use:dndzone={{ items: dndItems, flipDurationMs: flipMs, type: 'technologies' }}
		onconsider={handleConsider}
		onfinalize={handleFinalize}
	>
		{#each dndItems as item (item.id)}
			{@const profileOnly = isHiddenFromDocuments(item.row.data.tags)}
			<div animate:flip={{ duration: flipMs }}>
				<div
					class="flex cursor-grab items-center gap-1.5 rounded-lg border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/5 py-1.5 pr-3.5 pl-2 text-sm active:cursor-grabbing {profileOnly
						? 'opacity-60'
						: ''}"
				>
					<FontAwesomeIcon icon={faGripVertical} class="h-3 w-3 text-[var(--dash-text-muted)]" />
					<span class="text-[var(--dash-text)]">{item.row.data.name || 'Technology'}</span>
					{#if profileOnly}
						<FontAwesomeIcon icon={faEyeSlash} class="h-2.5 w-2.5 text-[var(--dash-text-muted)]" />
					{/if}
				</div>
			</div>
		{/each}
	</div>
	<div class="mt-4 flex items-center justify-end gap-2">
		<span class="mr-auto text-xs text-[var(--dash-text-muted)]"
			>Drag the chips to reorder, then save.</span
		>
		<button
			type="button"
			onclick={cancelReorder}
			class="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
		>
			Cancel
		</button>
		<SectionSaveButton state={reorderState} onClick={saveReorder} />
	</div>
{:else}
	<div class="flex flex-wrap gap-2">
		{#each store.rows as tech (tech.key)}
			{@const profileOnly = isHiddenFromDocuments(tech.data.tags)}
			{@const versionTags = versionTagsOf(tech.data.tags)}
			<div class="relative">
				<button
					type="button"
					onclick={() => open(tech)}
					aria-expanded={editingKey === tech.key}
					title={tech.field.error ?? undefined}
					class="flex items-center gap-1.5 rounded-lg border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/5 px-3.5 py-1.5 text-sm transition-colors hover:border-[var(--dash-primary)]/40 {profileOnly
						? 'opacity-60'
						: ''}"
				>
					<span
						class={tech.field.status === 'error'
							? 'text-[var(--dash-error)]'
							: 'text-[var(--dash-text)]'}>{tech.data.name || 'Technology'}</span
					>
					{#if profileOnly}
						<span title="Profile-only — counts for matching, not shown on documents">
							<FontAwesomeIcon
								icon={faEyeSlash}
								class="h-2.5 w-2.5 text-[var(--dash-text-muted)]"
							/>
						</span>
					{/if}
					{#if showVersionTags && versionTags.length > 0}
						<span
							class="inline-flex items-center gap-1 rounded border border-teal-500/30 bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-medium text-teal-600"
							title={versionTags.join(', ')}
							><FontAwesomeIcon icon={faTags} class="h-2 w-2" /> {versionTags.length}</span
						>
					{/if}
				</button>

				{#if editingKey === tech.key}
					<!-- Mobile backdrop -->
					<div class="fixed inset-0 z-40 bg-black/30 sm:hidden"></div>
					<div
						use:clickOutside={close}
						use:keepInView
						class="absolute top-full left-0 z-50 mt-1 w-64 space-y-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-3 shadow-lg"
					>
						<div>
							<label
								for="{uid}-name"
								class="mb-1 block text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase"
								>Name</label
							>
							<input
								id="{uid}-name"
								type="text"
								value={nameText}
								oninput={(e) => rename(tech, e.currentTarget.value)}
								onblur={() => saveNow(tech)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === 'Escape') close();
								}}
								use:focusIfAdded={tech.key}
								placeholder="Technology"
								autocomplete="off"
								class="w-full rounded border border-[var(--dash-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--dash-text)] focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none"
							/>
						</div>

						<ShowOnSwitches
							tags={tech.data.tags}
							ontoggle={(template, shown) =>
								retag(tech, setShownOn(tech.data.tags, template, shown))}
							field={tech.id === null ? undefined : tech.field}
						/>

						<VersionTagPicker
							tags={tech.data.tags}
							{versionSlugs}
							onchange={(tags) => retag(tech, tags)}
							bind:expanded={versionsExpanded}
						/>

						<div class="flex items-center justify-between pt-1">
							<button
								type="button"
								onclick={() => remove(tech)}
								class="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-500 transition-colors hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-600"
								aria-label="Delete technology"
							>
								<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
								Delete
							</button>
							<button
								type="button"
								onclick={close}
								class="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:text-emerald-700"
							>
								<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
								Done
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/each}
		<button
			type="button"
			onclick={add}
			class="flex items-center gap-1 rounded-lg border border-dashed border-[var(--dash-border)] px-3 py-1 text-sm text-[var(--dash-primary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary-hover)]"
		>
			<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
			Add
		</button>
	</div>
{/if}
{#if error}
	<p class="mt-3 text-sm text-[var(--dash-error)]">{error}</p>
{/if}
