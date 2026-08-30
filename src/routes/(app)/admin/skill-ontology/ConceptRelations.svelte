<script module lang="ts">
	export interface PanelConcept {
		id: number;
		label: string;
		slug: string;
	}
</script>

<script lang="ts">
	/**
	 * Everything else the graph says about one concept, opened beside the row
	 * being judged.
	 *
	 * ## Why the queue needed this
	 *
	 * A proposal is a claim about two concepts, and the queue renders it with no
	 * context at all: one sentence and three buttons. Deciding it well means
	 * knowing what those concepts already assert and what has already been said
	 * about them, and until now the only way to find that out was to query the
	 * database by hand. Every judgement call on `related` edges so far was
	 * settled by exactly one query, `WHERE from_id = X OR to_id = X`, run in a
	 * terminal.
	 *
	 * ## The rejected list is the point
	 *
	 * `Microservices related RabbitMQ` was not decided on anything about
	 * microservices. It was decided by ten rows already rejected around those two
	 * nodes: Kubernetes to each of them, Node.js, WebSockets, NestJS,
	 * Elasticsearch, Agile, OpenTelemetry, Docker Compose. That is the reviewing
	 * standard, and it is not written down anywhere else. It is not in
	 * `RELATION_GUIDE` and it is not in the design doc; it exists only as
	 * accumulated `rejected_at` timestamps, which no view rendered.
	 *
	 * So rejected edges are shown as prominently as approved ones. The graph
	 * views deliberately show neither, filtering on `approved_at IS NOT NULL`
	 * throughout, because they draw the ontology as it stands. This draws it as
	 * it has been argued.
	 *
	 * ## Why there is no query behind it
	 *
	 * The page's load already returns every row of `skill_relations` with both
	 * labels and the verdict, unpaginated, because the "In use" and "Rejected"
	 * sections render from the same array. So the evidence is on the client
	 * before anyone clicks, and this panel is a filter over data already paid
	 * for. No endpoint, no spinner, and nothing to race with `use:enhance`
	 * reloading the page after a verdict.
	 *
	 * Measured on the live vocabulary: a concept appearing in the pending queue
	 * touches a median of 8 edges and 16 at the 90th percentile, which is why
	 * this lists them flat rather than paging or collapsing.
	 */
	import { resolve } from '$app/paths';
	import { sentence, verbFor } from './graph/graph-shared';
	import type { PendingRelation } from './+page.server';

	let {
		concept,
		counterpart = null,
		relations,
		matching,
		onpivot,
		onclose
	}: {
		concept: PanelConcept;
		/**
		 * The other end of the row this was opened from, when there is one.
		 *
		 * Present so the panel can lead with the pair's own history, which is the
		 * one question the surrounding sections cannot answer: has this pair been
		 * ruled on before, in either direction. `superseded` covers the case where
		 * an approved edge already connects them, but a previously *rejected* one
		 * is invisible to it and is exactly as decisive.
		 */
		counterpart?: { id: number; label: string } | null;
		/** Every row in the table. Filtered here, never fetched. */
		relations: PendingRelation[];
		/** `MATCHING_RELATIONS`, from the server so it cannot drift. */
		matching: string[];
		/**
		 * Follow a concept from inside the panel.
		 *
		 * The comparison that decides a `related` edge is usually one hop away:
		 * judging `RabbitMQ ~ Apache Kafka` means looking at what else sits under
		 * "Message queues". Without this the panel answers one question and then
		 * sends you back to SQL for the next one.
		 */
		onpivot: (c: PanelConcept) => void;
		onclose: () => void;
	} = $props();

	/** Spelled out here so `svelte/no-navigation-without-resolve` can see it. */
	const GRAPH = resolve('/admin/skill-ontology/graph');

	function isPair(r: PendingRelation): boolean {
		if (!counterpart) return false;
		return (
			(r.from_id === concept.id && r.to_id === counterpart.id) ||
			(r.from_id === counterpart.id && r.to_id === concept.id)
		);
	}

	let pair = $derived(relations.filter(isPair));

	/**
	 * `inDomain` split off rather than listed.
	 *
	 * It is membership, never traversed, and it is the only relation that hubs:
	 * "IT" carries 78 of them against a median of 8 edges for everything else.
	 * Listing them would bury the four rows that matter under the one relation
	 * that cannot affect the decision. The count stays so nothing is hidden.
	 */
	let touching = $derived(
		relations.filter((r) => (r.from_id === concept.id || r.to_id === concept.id) && !isPair(r))
	);
	let domainCount = $derived(touching.filter((r) => r.relation === 'inDomain').length);
	let real = $derived(touching.filter((r) => r.relation !== 'inDomain'));

	let approved = $derived(real.filter((r) => r.approved));
	let pending = $derived(real.filter((r) => !r.approved && !r.rejected));
	let rejected = $derived(real.filter((r) => r.rejected));

	/**
	 * Concepts reaching the same approved parent this one reaches.
	 *
	 * The `related` bar is "could one stand in for the other", and a shared
	 * parent is the strongest cheap evidence for it: RabbitMQ and Apache Kafka
	 * are both `broader → Message queues`, which is most of the argument. It also
	 * catches the opposite case, where two things share only "IT" and the
	 * proposal is really co-occurrence.
	 *
	 * Approved parents only, and only through relations the matcher walks, so
	 * this is the same neighbourhood matching would produce rather than a
	 * plausible-looking one.
	 */
	let siblings = $derived.by(() => {
		const parents = relations.filter(
			(r) => r.approved && r.from_id === concept.id && matching.includes(r.relation)
		);
		const out = new Map<number, { id: number; label: string; slug: string; via: string }>();
		for (const p of parents) {
			for (const r of relations) {
				if (!r.approved || r.to_id !== p.to_id || r.from_id === concept.id) continue;
				if (!matching.includes(r.relation) || out.has(r.from_id)) continue;
				out.set(r.from_id, {
					id: r.from_id,
					label: r.from_label,
					slug: r.from_slug,
					via: p.to_label
				});
			}
		}
		return [...out.values()].sort((a, b) => a.label.localeCompare(b.label));
	});

	/** Enough to see the shape of a family without a wall of chips. */
	const SIBLING_LIMIT = 20;
</script>

<!--
	One edge, with the far end clickable and the near end left as plain text.

	Bolding the concept you already chose would emphasise the half you know. What
	the eye is scanning for is what it connects TO, so that is the half that gets
	weight and the affordance.
-->
{#snippet edge(r: PendingRelation, muted = false)}
	{@const outgoing = r.from_id === concept.id}
	{@const far = outgoing
		? { id: r.to_id, label: r.to_label, slug: r.to_slug }
		: { id: r.from_id, label: r.from_label, slug: r.from_slug }}
	<li
		class="py-0.5 {muted ? 'text-[var(--dash-text-muted)]' : 'text-[var(--dash-text-secondary)]'}"
	>
		{#if outgoing}
			<span>{r.relation === 'covers' ? `“${concept.label}”` : concept.label}</span>
			{verbFor(r.relation)}
			<button
				type="button"
				class="underline decoration-dotted underline-offset-2 hover:text-[var(--dash-primary)]"
				onclick={() => onpivot(far)}>{far.label}</button
			>
		{:else}
			<button
				type="button"
				class="underline decoration-dotted underline-offset-2 hover:text-[var(--dash-primary)]"
				onclick={() => onpivot(far)}
				>{r.relation === 'covers' ? `“${far.label}”` : far.label}</button
			>
			{verbFor(r.relation)}
			<span>{concept.label}</span>
		{/if}
		<span class="ml-1 text-xs text-[var(--dash-text-muted)]">{r.relation}</span>
	</li>
{/snippet}

<div
	class="mx-4 mb-3 rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg-inset)] px-3 py-2.5 text-sm"
>
	<div class="flex items-start justify-between gap-3">
		<div>
			<h3 class="font-medium text-[var(--dash-text)]">{concept.label}</h3>
			<p class="text-xs text-[var(--dash-text-muted)]">
				{approved.length} approved · {pending.length} pending · {rejected.length} rejected{domainCount
					? ` · ${domainCount} domain`
					: ''}
			</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<a
				href="{GRAPH}?concept={encodeURIComponent(concept.slug)}"
				class="text-xs text-[var(--dash-text-secondary)] underline hover:text-[var(--dash-primary)]"
			>
				Graph
			</a>
			<button
				type="button"
				onclick={onclose}
				aria-label="Close"
				class="rounded px-1.5 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]"
			>
				×
			</button>
		</div>
	</div>

	{#if counterpart}
		<!--
			The pair's own history, first because it can end the decision on its own.
			`superseded` already hides rows blocked by an APPROVED edge on the pair;
			a rejected one is invisible to it and says just as much.
		-->
		<div class="mt-2">
			<h4 class="text-xs font-medium text-[var(--dash-text)]">
				Between {concept.label} and {counterpart.label}
			</h4>
			<ul class="mt-0.5">
				{#each pair as r (r.id)}
					<li class="py-0.5 text-[var(--dash-text-secondary)]">
						{sentence(r.relation, r.from_label, r.to_label)}
						<span
							class="ml-1 rounded px-1 text-xs {r.approved
								? 'text-[var(--dash-success)]'
								: r.rejected
									? 'text-[var(--dash-danger)]'
									: 'text-[var(--dash-text-muted)]'}"
						>
							{r.approved ? 'approved' : r.rejected ? 'rejected' : 'pending'}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="mt-2 grid gap-3 sm:grid-cols-2">
		<div>
			<h4 class="text-xs font-medium text-[var(--dash-text)]">In use</h4>
			{#if approved.length === 0}
				<p class="text-xs text-[var(--dash-text-muted)]">
					No approved edges. This concept is not reachable by matching.
				</p>
			{:else}
				<ul class="mt-0.5">
					{#each approved as r (r.id)}{@render edge(r)}{/each}
				</ul>
			{/if}

			{#if pending.length > 0}
				<h4 class="mt-2 text-xs font-medium text-[var(--dash-text)]">Also waiting</h4>
				<ul class="mt-0.5">
					{#each pending as r (r.id)}{@render edge(r)}{/each}
				</ul>
			{/if}
		</div>

		<div>
			<!--
				Rejections are precedent, not history. Ten of these around two nodes
				is what a reviewing standard looks like before anyone writes it down.
			-->
			<h4 class="text-xs font-medium text-[var(--dash-text)]">Already rejected</h4>
			{#if rejected.length === 0}
				<p class="text-xs text-[var(--dash-text-muted)]">Nothing rejected here yet.</p>
			{:else}
				<ul class="mt-0.5">
					{#each rejected as r (r.id)}{@render edge(r, true)}{/each}
				</ul>
			{/if}

			{#if siblings.length > 0}
				<h4 class="mt-2 text-xs font-medium text-[var(--dash-text)]">
					Shares a parent with
					<span class="font-normal text-[var(--dash-text-muted)]">({siblings[0].via}…)</span>
				</h4>
				<p class="mt-0.5 flex flex-wrap gap-1">
					{#each siblings.slice(0, SIBLING_LIMIT) as s (s.id)}
						<button
							type="button"
							onclick={() => onpivot(s)}
							title="via {s.via}"
							class="rounded border border-[var(--dash-border)] px-1.5 py-0.5 text-xs text-[var(--dash-text-secondary)] hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)]"
						>
							{s.label}
						</button>
					{/each}
					{#if siblings.length > SIBLING_LIMIT}
						<span class="self-center text-xs text-[var(--dash-text-muted)]">
							+{siblings.length - SIBLING_LIMIT} more
						</span>
					{/if}
				</p>
			{/if}
		</div>
	</div>
</div>
