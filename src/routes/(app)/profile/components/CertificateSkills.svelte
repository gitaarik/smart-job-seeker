<script lang="ts">
	import { untrack } from 'svelte';
	import { remountOnAppliedChange } from '$lib/components/applied-change.svelte';
	import { sectionRows } from '$lib/components/section-rows.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import TechnologyTagsEditor from '$lib/components/TechnologyTagsEditor.svelte';

	/**
	 * One certificate's skills, each chip saving itself.
	 *
	 * The side-project technology editor, lifted onto a list page: a certificate
	 * has no page of its own, so its skills are edited in its expanded card, next
	 * to fields that still save with a button. The chips do not wait for that
	 * button, which is what the indicator beside the heading is there to say.
	 */
	interface Props {
		certificateId: number;
		profileId: number;
		skills: ReadonlyArray<{ id: number; name: string | null }>;
		/** After a write lands, so the collapsed card's list catches up. */
		onChanged?: () => void;
	}

	let { certificateId, profileId, skills, onChanged }: Props = $props();

	// Seeded once: the store owns the rows from here, and a proposal applied from
	// the chat panel mounts this again rather than re-seeding it underneath.
	remountOnAppliedChange();
	const loaded = untrack(() => ({ certificateId, profileId, skills }));

	const store = sectionRows({
		resource: 'certificate_skill',
		parentKey: 'certificate_id',
		parentId: loaded.certificateId,
		profileId: loaded.profileId,
		initial: loaded.skills,
		toData: (s) => ({ name: s.name ?? '' }),
		blank: () => ({ name: '' }),
		toBody: (v: { name: string }) => ({ name: v.name.trim() }),
		canCreate: (v: { name: string }) => v.name.trim().length > 0,
		onChanged: () => onChanged?.()
	});

	// Skills have no reorder here, so the editor's index and the store's row
	// index stay aligned: only `add` and `remove` change the length, and they
	// change both sides at once.
	let names = $state<string[]>(store.rows.map((row) => row.data.name));
	let lastAdded = $state<number | null>(null);
	let error = $state<string | null>(null);

	function add() {
		store.add();
		names = [...names, ''];
		lastAdded = names.length - 1;
	}

	function change(index: number, value: string) {
		const row = store.rows[index];
		if (row) store.update(row, { name: value });
	}

	function flush(index: number) {
		store.rows[index]?.field.flush();
	}

	/** A chip is one word; deleting it costs a retype, so it does not ask. */
	async function remove(index: number) {
		const row = store.rows[index];
		try {
			if (row) await store.remove(row);
			names = names.filter((_, i) => i !== index);
			if (lastAdded === index) lastAdded = null;
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not delete that skill';
		}
	}
</script>

<div>
	<div class="mb-2 flex items-center gap-3">
		<h4 class="text-sm font-medium text-[var(--dash-text)]">Skills</h4>
		<AutoSaveIndicator field={store.summary} idleLabel="Saves as you type" />
	</div>
	<TechnologyTagsEditor
		bind:technologies={names}
		itemLabel="Skill"
		lastAddedIndex={lastAdded}
		onAdd={add}
		onRemove={remove}
		onItemChange={change}
		onItemBlur={flush}
		onFocused={() => (lastAdded = null)}
	/>
	{#if error}
		<p class="mt-2 text-sm text-[var(--dash-error)]">{error}</p>
	{/if}
</div>
