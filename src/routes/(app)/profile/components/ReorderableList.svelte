<script lang="ts">
	import type { Snippet } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowsUpDown,
		faCalendarDays,
		faCircleNotch,
		faGripVertical
	} from '@fortawesome/free-solid-svg-icons';
	import { dragHandle, dragHandleZone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { invalidateAll } from '$app/navigation';
	import Card from '../../components/Card.svelte';

	interface Item {
		id: number;
		[key: string]: unknown;
	}

	interface Props {
		/** Current items in their stored display order. */
		items: Item[];
		/** Whether the list is currently date-sorted or manually ordered. */
		ordering: 'date' | 'manual';
		/** dndzone type — must be unique per list on a page. */
		type: string;
		/** Used in the "Reorder {label}" caption, e.g. "Projects". */
		label: string;
		/** Bound out so the page can hide its normal list while reordering. */
		reorderMode?: boolean;
		/** Hide the toolbar (e.g. while an add form is open). */
		disabled?: boolean;
		/** Renders the label for a single item inside a reorder row. */
		row: Snippet<[Item]>;
	}

	let {
		items,
		ordering,
		type,
		label,
		reorderMode = $bindable(false),
		disabled = false,
		row
	}: Props = $props();

	interface DndItem {
		id: string;
		item: Item;
		[key: string]: unknown;
	}

	let dndItems = $state<DndItem[]>([]);
	let reorderSaving = $state(false);
	let resetting = $state(false);
	const flipDurationMs = 150;

	let canReorder = $derived(items.length > 1);

	function startReorder() {
		dndItems = items.map((item) => ({ id: String(item.id), item }));
		reorderMode = true;
	}

	function handleConsider(e: CustomEvent<{ items: DndItem[] }>) {
		dndItems = e.detail.items;
	}

	function handleFinalize(e: CustomEvent<{ items: DndItem[] }>) {
		dndItems = e.detail.items;
	}

	async function postAction(action: string, body: Record<string, string>) {
		const formData = new FormData();
		for (const [key, value] of Object.entries(body)) {
			formData.append(key, value);
		}
		await fetch(`?/${action}`, { method: 'POST', body: formData });
		await invalidateAll();
	}

	async function confirmReorder() {
		reorderSaving = true;
		const order = dndItems.map((d) => parseInt(d.id)).filter((id) => !isNaN(id));
		try {
			await postAction('reorder', { order: JSON.stringify(order) });
		} finally {
			reorderSaving = false;
			reorderMode = false;
		}
	}

	function cancelReorder() {
		reorderMode = false;
	}

	async function resetToDate() {
		resetting = true;
		try {
			await postAction('resetOrder', {});
		} finally {
			resetting = false;
		}
	}
</script>

{#if reorderMode}
	{#snippet confirmCancel()}
		<div class="flex items-center justify-end gap-2">
			<span class="text-xs text-[var(--dash-text-muted)]">Reorder {label}</span>
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

	{@render confirmCancel()}
	<div
		class="mt-2 space-y-2"
		use:dragHandleZone={{ items: dndItems, flipDurationMs, type }}
		onconsider={handleConsider}
		onfinalize={handleFinalize}
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
						{@render row(dndItem.item)}
					</div>
				</Card>
			</div>
		{/each}
	</div>
	<div class="mt-2">
		{@render confirmCancel()}
	</div>
{:else if canReorder && !disabled}
	<div class="flex justify-end gap-2">
		{#if ordering === 'manual'}
			<button
				type="button"
				onclick={resetToDate}
				disabled={resetting}
				class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs font-medium text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)] disabled:opacity-70"
				title="Discard the manual order and sort by date again"
			>
				<FontAwesomeIcon
					icon={resetting ? faCircleNotch : faCalendarDays}
					spin={resetting}
					class="h-3 w-3"
				/>
				Sort by date
			</button>
		{/if}
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
