<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { RELATION_STYLES, verbFor } from './graph-shared';

	export interface DraftEnd {
		id: number;
		label: string;
	}

	let {
		from,
		to,
		onswap,
		oncancel,
		onblocked
	}: {
		from: DraftEnd;
		to: DraftEnd;
		onswap: () => void;
		oncancel: () => void;
		/**
		 * The caller's chance to offer a way out of a clash.
		 *
		 * A refusal naming an existing edge is the common case here, not an edge
		 * case: drawing the wrong edge and then the right one is the most likely
		 * way to use this wrongly, and the second attempt is refused BY the first.
		 * Without this the message names the problem and strands you.
		 */
		onblocked?: (id: number) => void;
	} = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);
	let blocking = $state<number | null>(null);

	/**
	 * Offered from `RELATION_STYLES`, validated against `GRAPH_RELATIONS`.
	 *
	 * Two lists, because one is a drawing concern and the other is a server
	 * constant that cannot be imported into a component. They can drift, and the
	 * drift is safe in the direction that matters: an option the server does not
	 * know fails closed with "Unknown relation" rather than writing a row nothing
	 * will ever traverse.
	 */
	const options = RELATION_STYLES;

	async function create(relation: string) {
		busy = true;
		error = null;
		const body = new FormData();
		body.set('from', String(from.id));
		body.set('to', String(to.id));
		body.set('relation', relation);

		const res = await fetch('?/createRelation', { method: 'POST', body });
		const result = deserialize(await res.text());
		busy = false;

		if (result.type === 'failure') {
			error = String(result.data?.error ?? 'Could not create that relation.');
			const id = Number(result.data?.blockingId);
			blocking = Number.isInteger(id) && id > 0 ? id : null;
			return;
		}
		if (result.type === 'error') {
			error = result.error?.message ?? 'Could not create that relation.';
			return;
		}
		await invalidateAll();
		oncancel();
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') oncancel();
	}}
/>

<div
	class="w-[26rem] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-3 shadow-lg"
	role="dialog"
	aria-label="Choose a relation"
>
	<div class="flex items-baseline justify-between gap-2">
		<h2 class="text-sm font-medium text-[var(--dash-text)]">What is the relation?</h2>
		<button
			type="button"
			class="text-xs text-[var(--dash-text-secondary)] underline hover:text-[var(--dash-primary)]"
			onclick={onswap}
			disabled={busy}
		>
			Swap direction
		</button>
	</div>

	<!--
		Every option is spelled out as the whole sentence, not just the relation
		name. Inverted direction is the failure mode this table exists to prevent —
		it is why the queue has a Flip button at all — and "broader" on its own does
		not tell you which end is which.
	-->
	<div class="mt-2 flex flex-col gap-1">
		{#each options as o (o.relation)}
			<button
				type="button"
				class="rounded-md border border-[var(--dash-border)] px-2.5 py-1.5 text-left text-xs text-[var(--dash-text)] hover:border-[var(--dash-primary)] hover:bg-[var(--dash-bg-hover)] disabled:opacity-50"
				onclick={() => create(o.relation)}
				disabled={busy}
			>
				<span class="font-medium">“{from.label}”</span>
				<span class="text-[var(--dash-primary)]">{verbFor(o.relation)}</span>
				<span class="font-medium">“{to.label}”</span>
			</button>
		{/each}
	</div>

	{#if error}
		<p
			class="mt-2 rounded-md border border-[var(--dash-error)] bg-[var(--dash-error-light)] px-2.5 py-1.5 text-xs text-[var(--dash-error)]"
			role="alert"
		>
			{error}
			{#if blocking !== null && onblocked}
				<button
					type="button"
					class="ml-2 underline"
					onclick={() => {
						const id = blocking;
						blocking = null;
						if (id !== null) onblocked?.(id);
					}}>Retire that one instead</button
				>
			{/if}
		</p>
	{/if}

	<button
		type="button"
		class="mt-2 text-xs text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
		onclick={oncancel}
		disabled={busy}
	>
		Cancel (Esc)
	</button>
</div>
