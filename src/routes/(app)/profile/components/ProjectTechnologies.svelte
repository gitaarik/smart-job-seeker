<script lang="ts">
	/**
	 * The technology chips under one project.
	 *
	 * A component of its own so the store is created at component init, which is
	 * what gives its per-chip `autoSaveField`s an `onDestroy` to deregister from.
	 * It is mounted only once the project has an id, so `projectId` never changes
	 * under it.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faPlus, faTimes } from '@fortawesome/free-solid-svg-icons';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import { sectionRows } from '$lib/components/section-rows.svelte';

	interface TechData extends Record<string, unknown> {
		name: string;
	}

	let {
		projectId,
		profileId,
		initial = []
	}: {
		projectId: number;
		profileId: number;
		initial?: Array<{ id: number; name: string | null }>;
	} = $props();

	const store = sectionRows({
		resource: 'work_experience_project_technology',
		parentKey: 'work_experience_project_id',
		parentId: projectId,
		profileId,
		initial,
		toData: (r) => ({ name: r.name ?? '' }),
		blank: () => ({ name: '' }),
		toBody: (v) => ({ name: v.name.trim() }),
		canCreate: (v) => v.name.trim().length > 0
	});

	let added = $state<number | null>(null);

	/**
	 * Add chips from outside this component.
	 *
	 * The store is created in here (see the note above), so a parent offering
	 * suggested technologies has no way to reach it. Exported rather than lifted
	 * because lifting the store would cost the per-chip autoSaveField the
	 * `onDestroy` it deregisters from. Reached via `bind:this`.
	 */
	export function addTechnologies(names: string[]) {
		for (const name of names) {
			const trimmed = name.trim();
			if (!trimmed) continue;
			const row = store.add();
			// A blank draft is not written; the name has to arrive through update.
			store.update(row, { name: trimmed });
		}
	}

	function focusNew(node: HTMLInputElement, isNew: boolean) {
		if (isNew) {
			node.focus();
			added = null;
		}
	}
</script>

<!--
	The heading lives here rather than in the row above so it can carry the chips'
	save state beside it. A chip is too small for a pill of its own and there is
	nowhere to put twelve of them; what the user needs to know is whether the list
	is saving, which is one answer for the whole list.
-->
<div class="mb-1 flex items-center gap-3">
	<span class="block text-sm font-medium text-[var(--dash-text)]">Technologies</span>
	<AutoSaveIndicator field={store.summary} idleLabel="Saves as you type" />
</div>

<div class="flex flex-wrap gap-2">
	{#each store.rows as tech (tech.key)}
		<div
			class="flex items-center gap-1 rounded-lg border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/5 py-1 pr-1 pl-3.5"
			class:opacity-60={tech.field.status === 'saving'}
			title={tech.field.error ?? undefined}
		>
			<div class="relative pr-3">
				<span class="invisible min-w-[3ch] text-sm whitespace-pre"
					>{tech.data.name || 'Technology'}</span
				>
				<input
					type="text"
					value={tech.data.name}
					oninput={(e) => store.update(tech, { name: e.currentTarget.value })}
					onblur={tech.field.flush}
					use:focusNew={added === tech.key}
					placeholder="Technology"
					aria-label="Technology"
					class="absolute inset-0 w-full border-none bg-transparent pr-3 text-sm focus:outline-none {tech
						.field.status === 'error'
						? 'text-[var(--dash-error)]'
						: 'text-[var(--dash-text)]'}"
				/>
			</div>
			<button
				type="button"
				onclick={() => store.remove(tech)}
				class="p-1 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-error)]"
				aria-label="Remove technology"
			>
				<FontAwesomeIcon icon={faTimes} class="h-3 w-3" />
			</button>
		</div>
	{/each}
	<button
		type="button"
		onclick={() => (added = store.add().key)}
		class="flex items-center gap-1 rounded-lg border border-dashed border-[var(--dash-border)] px-3 py-1 text-sm text-[var(--dash-primary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary-hover)]"
	>
		<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
		Add
	</button>
</div>
