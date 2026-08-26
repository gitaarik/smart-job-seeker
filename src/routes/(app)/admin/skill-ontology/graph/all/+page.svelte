<script lang="ts">
	import { resolve } from '$app/paths';
	import { RELATION_STYLES, dashFor, edgePath } from '../graph-shared';
	import { layoutFullGraph, type Dims } from './island-layout';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const GRAPH = resolve('/admin/skill-ontology/graph');

	/**
	 * Smaller than the focused view's boxes, deliberately.
	 *
	 * There the question is about one concept and a 152px box can spell out its
	 * name. Here the question is about shape — how many islands, how deep, what
	 * is missing — and 116 boxes at that size would need scrolling in both
	 * directions to answer it. A label that truncates is a smaller loss than a
	 * picture you cannot see at once, and every node links to the view that
	 * spells it out.
	 */
	const DIMS: Dims = {
		nodeW: 124,
		nodeH: 32,
		colGap: 44,
		rowGap: 8,
		islandPad: 14,
		islandGap: 22,
		maxWidth: 980
	};

	let layout = $derived(layoutFullGraph(data.nodes, data.edges, DIMS));
	let counts = $derived({
		drawn: data.nodes.length,
		edges: data.edges.length,
		islands: layout.islands.length,
		isolated: data.isolated.length
	});
</script>

<svelte:head><title>Whole skill graph · Admin</title></svelte:head>

<div class="space-y-4">
	<div class="flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold text-[var(--dash-text)]">Whole skill graph</h1>
			<p class="mt-1 text-sm text-[var(--dash-text-secondary)]">
				Every concept an approved edge touches. Click one to see just its neighbourhood.
			</p>
		</div>
		<div class="flex shrink-0 gap-2">
			<a
				href={GRAPH}
				class="rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]"
			>
				Focus one
			</a>
			<a
				href={resolve('/admin/skill-ontology')}
				class="rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]"
			>
				Review queue
			</a>
		</div>
	</div>

	<!--
		The count that matters is `isolated`, and it is stated before the picture
		rather than under it. The diagram cannot show an absence: a concept with no
		edges has nothing to draw, so the one finding this page exists for would be
		invisible in the very thing it is a page of.
	-->
	<div
		class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-4 py-3 text-sm text-[var(--dash-text)]"
	>
		{counts.drawn} concepts and {counts.edges} relations, in
		<strong>{counts.islands} disconnected {counts.islands === 1 ? 'island' : 'islands'}</strong>.
		{#if counts.isolated > 0}
			A further <strong>{counts.isolated}</strong> concepts have no approved relation at all — they match
			nothing but their own name.
		{/if}
	</div>

	{#if data.nodes.length === 0}
		<div
			class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-6 text-sm text-[var(--dash-text-secondary)]"
		>
			No approved relations yet. Nothing to draw until something is approved in the review queue.
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
				<span class="ml-auto">Arrows run left to right, specific to general.</span>
			</div>

			<div class="overflow-x-auto p-3">
				<div
					class="relative"
					style="width:{layout.width}px; height:{layout.height}px; min-width:100%;"
				>
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

						<!-- Island borders, so eighteen islands look like eighteen islands. -->
						{#each layout.islands as island (`${island.x}-${island.y}`)}
							<rect
								x={island.x}
								y={island.y}
								width={island.w}
								height={island.h}
								rx="8"
								fill="none"
								stroke="currentColor"
								stroke-width="1"
								opacity="0.25"
							/>
						{/each}

						{#each data.edges as e (`${e.from_id}-${e.to_id}-${e.relation}`)}
							{@const a = layout.pos[e.from_id]}
							{@const b = layout.pos[e.to_id]}
							{#if a && b}
								<path
									d={edgePath(a, b, DIMS.nodeW, DIMS.nodeH)}
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-dasharray={dashFor(e.relation)}
									marker-end="url(#arrow)"
								/>
							{/if}
						{/each}
					</svg>

					{#each data.nodes as n (n.id)}
						{@const p = layout.pos[n.id]}
						{#if p}
							<a
								href="{GRAPH}?concept={encodeURIComponent(n.slug)}"
								title={n.label}
								class="absolute flex items-center justify-center rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-1.5 text-center text-[11px] leading-tight text-[var(--dash-text)] transition-colors hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)] focus-visible:ring-2 focus-visible:ring-[var(--dash-primary)] focus-visible:outline-none"
								style="left:{p.x}px; top:{p.y}px; width:{DIMS.nodeW}px; height:{DIMS.nodeH}px;"
							>
								<span class="line-clamp-2">{n.label}</span>
							</a>
						{/if}
					{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if data.isolated.length > 0}
		<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]">
			<h2
				class="border-b border-[var(--dash-border)] px-4 py-2.5 text-sm font-medium text-[var(--dash-text)]"
			>
				No approved relations ({data.isolated.length})
			</h2>
			<p class="px-4 pt-3 text-xs text-[var(--dash-text-secondary)]">
				Names, not links: the answer for every one of them is the same, and it is the count that is
				worth reading. A skill here still matches a job asking for it by name — it simply reaches
				nothing else.
			</p>
			<div class="flex flex-wrap gap-1.5 px-4 py-3">
				{#each data.isolated as c (c.id)}
					<span
						class="rounded-md border border-[var(--dash-border)] px-2 py-0.5 text-xs text-[var(--dash-text-secondary)]"
						>{c.label}</span
					>
				{/each}
			</div>
		</div>
	{/if}
</div>
