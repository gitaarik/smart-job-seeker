<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import EdgeDraft from './EdgeDraft.svelte';
	import { RELATION_STYLES, dashFor, edgePath, verbFor } from './graph-shared';
	import type { PageData } from './$types';

	/** Every href on this page points back at this route. */
	const GRAPH = resolve('/admin/skill-ontology/graph');

	let { data }: { data: PageData } = $props();

	let query = $state(data.root?.label ?? '');

	/**
	 * Nodes are HTML, edges are SVG.
	 *
	 * The first cut drew both in SVG and every node came out a solid black box:
	 * `fill-base-100` and friends are daisyUI utilities and this app does not use
	 * daisyUI — it is Tailwind v4 over a hand-rolled palette (`--dash-*`). An
	 * unresolved `fill-…` class is not an error, it is simply no fill, so `rect`
	 * fell back to black and black text sat on top of it, invisible.
	 *
	 * Positioned HTML sidesteps the whole class of problem: a div takes the same
	 * theme variables every other admin page uses, gets real hover and focus
	 * states, and truncates text with CSS rather than by counting characters.
	 * SVG keeps only the job it is actually better at — drawing curves.
	 */
	// Sized so the common case — four columns, which is most of this vocabulary —
	// fits the admin content width without horizontal scrolling. A five-column
	// chain still scrolls, and that is the right trade: shrinking further to fit
	// the rare deep case would waste space on every other one.
	const NODE_W = 152;
	const NODE_H = 44;
	const COL_GAP = 76;
	const ROW_GAP = 20;
	const PAD = 28;

	/**
	 * Editing here is CLICK to connect, not drag.
	 *
	 * The whole-graph view drags because its nodes are xyflow's; these are plain
	 * anchors over an SVG, and click-to-connect is both simpler and the thing that
	 * makes this view keyboard-operable — the one capability the drag surface
	 * explicitly does not have. Pick a source, pick a target, choose a relation.
	 *
	 * Off by default. This page is read far more often than it is edited, and in
	 * edit mode the nodes stop being links to other neighbourhoods, which is a
	 * surprising thing to inflict on someone who only came to look.
	 */
	let editing = $state(false);
	let from = $state<number | null>(null);
	let draft = $state<{ from: number; to: number } | null>(null);
	let retiring = $state<{ id: number; label: string } | null>(null);
	let error = $state<string | null>(null);
	/** Target chosen from the whole vocabulary, for an edge leaving the neighbourhood. */
	let farTarget = $state('');

	const labelById = $derived(
		Object.fromEntries(data.nodes.map((n) => [n.id, n.label])) as Record<number, string>
	);

	function pick(id: number) {
		error = null;
		retiring = null;
		if (from === null) {
			from = id;
		} else if (from === id) {
			from = null;
		} else {
			draft = { from, to: id };
			from = null;
		}
	}

	/**
	 * Connect to something the neighbourhood does not contain.
	 *
	 * Most edges worth adding point OUT of the view — that is usually why they are
	 * missing. Restricting the target to what happens to be on screen would leave
	 * exactly the gaps this page is good at revealing.
	 */
	function connectFar() {
		const target = data.concepts.find((c) => c.label === farTarget);
		if (from === null || !target) return;
		draft = { from, to: target.id };
		from = null;
		farTarget = '';
	}

	async function retire() {
		if (!retiring) return;
		const body = new FormData();
		body.set('id', String(retiring.id));
		const res = await fetch('?/retireRelation', { method: 'POST', body });
		retiring = null;
		if (res.ok) await invalidateAll();
	}

	let suggestions = $derived(
		query.trim().length < 1
			? []
			: data.concepts
					.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()))
					.slice(0, 10)
	);

	/**
	 * One column per depth, left to right: children, the focused concept, then
	 * each level of ancestry.
	 *
	 * Deterministic on purpose — sorted by label within a column — so the same
	 * concept renders identically every time and a screenshot is reproducible. A
	 * force simulation would look livelier and settle somewhere new on every load.
	 */
	let layout = $derived.by(() => {
		const depths = [...new Set(data.nodes.map((n) => n.depth))].sort((a, b) => a - b);
		const byDepth = depths.map((d) =>
			data.nodes.filter((n) => n.depth === d).sort((a, b) => a.label.localeCompare(b.label))
		);
		const tallest = Math.max(1, ...byDepth.map((c) => c.length));
		const height = PAD * 2 + tallest * NODE_H + (tallest - 1) * ROW_GAP;
		const width = PAD * 2 + depths.length * NODE_W + Math.max(0, depths.length - 1) * COL_GAP;

		// Where each zone starts and how wide it is, for the header band. The
		// columns already encode the direction of implication — labelling them is
		// what lets the diagram say so on its own, instead of leaving it to a
		// caption underneath that a reader may never reach.
		const leftCols = depths.filter((d) => d < 0).length;
		const rightCols = depths.filter((d) => d > 0).length;
		const colX = (i: number) => PAD + i * (NODE_W + COL_GAP);
		const zones = [
			leftCols > 0 && {
				label: 'reaches it',
				x: colX(0),
				w: leftCols * NODE_W + (leftCols - 1) * COL_GAP
			},
			{ label: 'listed skill', x: colX(leftCols), w: NODE_W },
			rightCols > 0 && {
				label: 'also matches',
				x: colX(leftCols + 1),
				w: rightCols * NODE_W + (rightCols - 1) * COL_GAP
			}
		].filter(Boolean) as { label: string; x: number; w: number }[];

		// A record rather than a Map: this is rebuilt whole on every recompute and
		// never mutated in place, which is the case `svelte/prefer-svelte-reactivity`
		// exists to catch, and a plain object says so without the import.
		const pos: Record<number, { x: number; y: number }> = {};
		byDepth.forEach((col, ci) => {
			const colH = col.length * NODE_H + (col.length - 1) * ROW_GAP;
			const top = (height - colH) / 2;
			col.forEach((n, ri) => {
				pos[n.id] = { x: PAD + ci * (NODE_W + COL_GAP), y: top + ri * (NODE_H + ROW_GAP) };
			});
		});
		return { pos, width, height, zones };
	});

	let reached = $derived(data.nodes.filter((n) => n.depth > 0).length);

	function path(fromId: number, toId: number): string {
		const a = layout.pos[fromId];
		const b = layout.pos[toId];
		return a && b ? edgePath(a, b, NODE_W, NODE_H) : '';
	}
</script>

<svelte:head><title>Skill graph · Admin</title></svelte:head>

<div class="space-y-4">
	<div class="flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold text-[var(--dash-text)]">Skill graph</h1>
			<p class="mt-1 text-sm text-[var(--dash-text-secondary)]">
				What a profile listing this skill expands to — approved edges only, the same traversal the
				matcher runs.
			</p>
		</div>
		<div class="flex shrink-0 gap-2">
			<a
				href={resolve('/admin/skill-ontology/graph/all')}
				class="rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]"
			>
				Whole graph
			</a>
			<a
				href={resolve('/admin/skill-ontology')}
				class="rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]"
			>
				Review queue
			</a>
		</div>
	</div>

	<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4">
		<label
			class="mb-1.5 block text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase"
			for="concept"
		>
			Concept
		</label>
		<input
			id="concept"
			class="w-full rounded-md border border-[var(--dash-border-input)] bg-[var(--dash-bg)] px-3 py-2 text-sm text-[var(--dash-text)]"
			placeholder="React, Django, PostgreSQL…"
			bind:value={query}
			autocomplete="off"
		/>
		{#if suggestions.length > 0 && query.trim().toLowerCase() !== data.root?.label.toLowerCase()}
			<div class="mt-2.5 flex flex-wrap gap-1.5">
				{#each suggestions as s (s.id)}
					<a
						href="{GRAPH}?concept={encodeURIComponent(s.slug)}"
						class="rounded-md border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)]"
					>
						{s.label}
					</a>
				{/each}
			</div>
		{/if}
	</div>

	{#if !data.root}
		<div
			class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-6 text-sm text-[var(--dash-text-secondary)]"
		>
			Pick a concept above — {data.concepts.length} in the vocabulary — or
			<a
				class="text-[var(--dash-primary)] underline"
				href={resolve('/admin/skill-ontology/graph/all')}>see all of them at once</a
			>.
		</div>
	{:else if data.nodes.length <= 1}
		<div
			class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-6 text-sm text-[var(--dash-text)]"
		>
			<strong>{data.root.label}</strong> has no approved relations yet — it is in the vocabulary but connects
			to nothing, so it only ever matches its own name.
		</div>
	{:else}
		<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]">
			<div
				class="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--dash-border)] px-4 py-2.5 text-xs text-[var(--dash-text-secondary)]"
			>
				{#each RELATION_STYLES as r (r.relation)}
					<span class="flex items-center gap-1.5">
						<svg width="24" height="8" aria-hidden="true">
							<line
								x1="0"
								y1="4"
								x2="24"
								y2="4"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-dasharray={r.dash}
							/>
						</svg>
						{r.label}
					</span>
				{/each}

				<button
					type="button"
					class="ml-auto rounded-md border px-2.5 py-1 text-xs transition-colors {editing
						? 'border-[var(--dash-primary)] bg-[var(--dash-primary)] text-white'
						: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]'}"
					onclick={() => {
						editing = !editing;
						from = null;
						draft = null;
						retiring = null;
						error = null;
					}}
				>
					{editing ? 'Done editing' : 'Edit'}
				</button>
			</div>

			{#if editing}
				<div
					class="flex flex-wrap items-center gap-3 border-b border-[var(--dash-border)] bg-[var(--dash-bg)] px-4 py-2.5 text-xs"
				>
					{#if draft}
						<EdgeDraft
							from={{ id: draft.from, label: labelById[draft.from] ?? '?' }}
							to={{
								id: draft.to,
								label:
									labelById[draft.to] ?? data.concepts.find((c) => c.id === draft?.to)?.label ?? '?'
							}}
							onswap={() => (draft = draft && { from: draft.to, to: draft.from })}
							oncancel={() => (draft = null)}
							onblocked={(id) => {
								draft = null;
								retiring = { id, label: 'the edge already between these two' };
							}}
						/>
					{:else if retiring}
						<span class="text-[var(--dash-text)]">Retire <strong>{retiring.label}</strong>?</span>
						<button
							type="button"
							class="rounded-md border border-[var(--dash-border)] px-2.5 py-1 text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]"
							onclick={retire}>Retire</button
						>
						<button
							type="button"
							class="text-[var(--dash-text-secondary)] underline"
							onclick={() => (retiring = null)}>Cancel</button
						>
						<span class="text-[var(--dash-text-muted)]"
							>It returns to the review queue, unapproved — not deleted.</span
						>
					{:else if from !== null}
						<span class="text-[var(--dash-text)]"
							>From <strong>{labelById[from]}</strong> — now pick a target, or</span
						>
						<input
							list="all-concepts"
							bind:value={farTarget}
							placeholder="a concept not shown here…"
							class="rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-2 py-1 text-[var(--dash-text)]"
						/>
						<button
							type="button"
							class="rounded-md border border-[var(--dash-border)] px-2.5 py-1 text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)] disabled:opacity-40"
							disabled={!data.concepts.some((c) => c.label === farTarget)}
							onclick={connectFar}>Connect</button
						>
						<button
							type="button"
							class="text-[var(--dash-text-secondary)] underline"
							onclick={() => (from = null)}>Cancel</button
						>
					{:else}
						<span class="text-[var(--dash-text-secondary)]">
							Pick a concept to connect from, or click a line to retire it.
						</span>
					{/if}
					{#if error}<span class="text-[var(--dash-danger,#dc2626)]">{error}</span>{/if}
				</div>
				<datalist id="all-concepts">
					{#each data.concepts as c (c.id)}<option value={c.label}></option>{/each}
				</datalist>
			{/if}

			<div class="overflow-x-auto p-2">
				<div class="relative mx-auto" style="width:{layout.width}px;">
					<div class="relative mb-1 h-4">
						{#each layout.zones as z (z.label)}
							<span
								class="absolute text-center text-[11px] tracking-wide text-[var(--dash-text-muted)] uppercase"
								style="left:{z.x}px; width:{z.w}px;">{z.label}</span
							>
						{/each}
					</div>
					<div class="relative" style="height:{layout.height}px;">
						<svg
							class="pointer-events-none absolute inset-0 text-[var(--dash-text-muted)]"
							width={layout.width}
							height={layout.height}
							aria-hidden="true"
						>
							<defs>
								<marker
									id="arrow"
									viewBox="0 0 8 8"
									refX="7"
									refY="4"
									markerWidth="7"
									markerHeight="7"
									orient="auto"
								>
									<path d="M 0 1 L 7 4 L 0 7 z" fill="currentColor" />
								</marker>
							</defs>
							{#each data.edges as e (e.id)}
								<path
									d={path(e.from_id, e.to_id)}
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-dasharray={dashFor(e.relation)}
									marker-end="url(#arrow)"
								/>
								{#if editing}
									<!--
										A second, invisible, much thicker copy of the same curve. A
										1.5px stroke is a 1.5px hit target, which is not a thing
										anyone can click; 14px transparent is, and it keeps the
										drawn line unchanged.
									-->
									<path
										d={path(e.from_id, e.to_id)}
										fill="none"
										stroke="transparent"
										stroke-width="14"
										class="pointer-events-auto cursor-pointer"
										role="button"
										tabindex="0"
										aria-label="Retire {labelById[e.from_id]} {verbFor(e.relation)} {labelById[
											e.to_id
										]}"
										onclick={() => {
											from = null;
											draft = null;
											retiring = {
												id: e.id,
												label: `${labelById[e.from_id]} ${verbFor(e.relation)} ${labelById[e.to_id]}`
											};
										}}
										onkeydown={(ev) => {
											if (ev.key !== 'Enter' && ev.key !== ' ') return;
											ev.preventDefault();
											from = null;
											draft = null;
											retiring = {
												id: e.id,
												label: `${labelById[e.from_id]} ${verbFor(e.relation)} ${labelById[e.to_id]}`
											};
										}}
									/>
								{/if}
							{/each}
						</svg>

						{#each data.nodes as n (n.id)}
							{@const p = layout.pos[n.id]}
							{@const base =
								'absolute flex items-center justify-center rounded-md border px-2 text-center text-[13px] leading-tight transition-colors'}
							{@const tone =
								n.depth === 0
									? 'border-[var(--dash-primary)] bg-[var(--dash-primary)] font-semibold text-white'
									: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)]'}
							{@const box = `left:${p?.x}px; top:${p?.y}px; width:${NODE_W}px; height:${NODE_H}px;`}
							{#if p && editing}
								<button
									type="button"
									title={from === null ? `Connect from ${n.label}` : `Connect to ${n.label}`}
									class="{base} {from === n.id
										? 'border-[var(--dash-primary)] ring-2 ring-[var(--dash-primary)]'
										: tone} cursor-pointer"
									style={box}
									onclick={() => pick(n.id)}
								>
									<span class="line-clamp-2">{n.label}</span>
								</button>
							{:else if p}
								<a
									href="{GRAPH}?concept={encodeURIComponent(n.slug)}"
									title={n.label}
									class="{base} {tone}"
									style={box}
								>
									<span class="line-clamp-2">{n.label}</span>
								</a>
							{/if}
						{/each}
					</div>
				</div>
			</div>

			<p
				class="border-t border-[var(--dash-border)] px-4 py-2.5 text-xs text-[var(--dash-text-secondary)]"
			>
				A profile listing <strong class="text-[var(--dash-text)]">{data.root.label}</strong> matches
				jobs asking for {reached === 1 ? 'the one skill' : `any of the ${reached} skills`} on the right.
				The arrows run one way: nothing on the left is implied by it.
			</p>
		</div>
	{/if}
</div>
