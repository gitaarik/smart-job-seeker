<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		Background,
		BackgroundVariant,
		Controls,
		MarkerType,
		MiniMap,
		SvelteFlow,
		SvelteFlowProvider,
		ViewportPortal,
		type Edge,
		type Node,
		type NodeTypes
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { RELATION_STYLES, dashFor } from '../graph-shared';
	import ConceptNode, { type ConceptNodeData } from './ConceptNode.svelte';
	import GraphSearch from './GraphSearch.svelte';
	import { setGraphHighlight } from './highlight.svelte';
	import { bestShelfWidth, layoutFullGraph, type Dims } from './island-layout';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const GRAPH = resolve('/admin/skill-ontology/graph');

	setGraphHighlight();

	/**
	 * Smaller than the focused view's boxes, deliberately.
	 *
	 * There the question is about one concept and a 152px box can spell out its
	 * name. Here the question is about shape — how many islands, how deep, what
	 * is missing — so the whole thing wants to fit before you touch anything.
	 * A label that truncates at rest is a smaller loss than a picture you have to
	 * assemble from fragments, and now the answer to a truncated label is to zoom
	 * rather than to leave the page.
	 */
	const BOX = {
		nodeW: 124,
		nodeH: 32,
		colGap: 44,
		rowGap: 8,
		islandPad: 14,
		islandGap: 22
	};

	/**
	 * Roughly the shape of the canvas below, and only roughly on purpose.
	 *
	 * The exact ratio is a browser measurement this has no access to at load, and
	 * chasing it with a resize observer would relayout the whole graph every time
	 * the window moved. The objective curve is flat near its peak — several shelf
	 * widths fit within a percent of the best — so an approximate target lands on
	 * the same answer as an exact one.
	 */
	const CANVAS_ASPECT = 1.66;

	const DIMS = $derived<Dims>({
		...BOX,
		maxWidth: bestShelfWidth(data.nodes, data.edges, BOX, CANVAS_ASPECT)
	});

	/**
	 * Svelte Flow does no layout, which is the entire reason it is the one graph
	 * library used here: `island-layout.ts` stays the source of every position,
	 * with its tests, and this file only renders what it decides. Dragging is off
	 * for the same reason — a node's column is its longest path to a sink, so a
	 * node moved one column left is a picture telling a lie.
	 */
	const nodeTypes: NodeTypes = { concept: ConceptNode };

	const layout = $derived(layoutFullGraph(data.nodes, data.edges, DIMS));

	const nodes = $derived<Node[]>(
		data.nodes.map((n) => ({
			id: String(n.id),
			type: 'concept',
			position: layout.pos[n.id] ?? { x: 0, y: 0 },
			// Given rather than measured: the size is already known, and letting
			// Svelte Flow measure 116 DOM nodes first would draw one frame of
			// every edge collapsed onto a point.
			width: DIMS.nodeW,
			height: DIMS.nodeH,
			draggable: false,
			selectable: false,
			data: {
				label: n.label,
				slug: n.slug,
				island: layout.islandOf[n.id] ?? -1
			} satisfies ConceptNodeData
		}))
	);

	const edges = $derived<Edge[]>(
		data.edges.map((e) => ({
			id: `${e.from_id}-${e.to_id}-${e.relation}`,
			source: String(e.from_id),
			target: String(e.to_id),
			selectable: false,
			focusable: false,
			markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
			style: dashFor(e.relation) ? `stroke-dasharray: ${dashFor(e.relation)};` : undefined
		}))
	);

	const searchable = $derived(data.nodes.map((n) => ({ id: String(n.id), label: n.label })));

	const counts = $derived({
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
				Every concept an approved edge touches. Scroll to zoom, drag to pan, click one to see just
				its neighbourhood.
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
		<SvelteFlowProvider>
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
					<div class="ml-auto"><GraphSearch labels={searchable} /></div>
				</div>

				<div class="skill-flow h-[clamp(460px,calc(100vh-21rem),900px)] w-full">
					<SvelteFlow
						{nodes}
						{edges}
						{nodeTypes}
						fitView
						fitViewOptions={{ maxZoom: 1, padding: 0.06 }}
						nodesDraggable={false}
						nodesConnectable={false}
						elementsSelectable={false}
						minZoom={0.15}
						maxZoom={2.5}
					>
						<!--
							Islands are decoration in graph coordinates, so they belong in the
							viewport's back layer rather than being modelled as nodes. Nodes
							would put eighteen empty rectangles into the tab order and the
							minimap, to draw a border.
						-->
						<ViewportPortal target="back">
							{#each layout.islands as island, i (i)}
								<div
									class="skill-island"
									style="left:{island.x}px; top:{island.y}px; width:{island.w}px; height:{island.h}px;"
								></div>
							{/each}
						</ViewportPortal>

						<Background variant={BackgroundVariant.Dots} gap={26} size={1} />
						<Controls showLock={false} />
						<!-- 200x150 is the default and it sat on top of a whole island. -->
						<MiniMap
							pannable
							zoomable
							width={140}
							height={104}
							ariaLabel="Whole skill graph minimap"
						/>
					</SvelteFlow>
				</div>
			</div>
		</SvelteFlowProvider>
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

<style>
	/*
	 * Themed by mapping Svelte Flow's own variables onto the dashboard palette
	 * rather than by using its `colorMode` prop. The app switches themes with a
	 * `.theme-dark` class that already flips every `--dash-*`, so one mapping is
	 * correct in both themes and cannot drift out of step with the app's toggle.
	 */
	.skill-flow {
		--xy-background-color: var(--dash-card);
		--xy-background-pattern-color: var(--dash-border);
		--xy-edge-stroke: var(--dash-text-muted);
		--xy-edge-stroke-width: 1.5;
		--xy-controls-button-background-color: var(--dash-card);
		--xy-controls-button-background-color-hover: var(--dash-bg-inset);
		--xy-controls-button-color: var(--dash-text-secondary);
		--xy-controls-button-color-hover: var(--dash-primary);
		--xy-controls-button-border-color: var(--dash-border);
		--xy-minimap-background-color: var(--dash-card);
	}

	.skill-island {
		position: absolute;
		border: 1px solid var(--dash-text-muted);
		border-radius: 8px;
		opacity: 0.25;
	}

	/* Anchor points only, until step 2 turns on edge drawing. */
	.skill-flow :global(.svelte-flow__handle) {
		opacity: 0;
		pointer-events: none;
	}

	/*
	 * Translucent until you want it. There is no free corner — the packed graph
	 * reaches all four — and at the default zoom the whole graph is already on
	 * screen, so a solid minimap spends its most-visible moment hiding an island
	 * to duplicate what is right next to it. It earns its place only once you
	 * have zoomed in, which is exactly when the pointer is heading for it.
	 */
	.skill-flow :global(.svelte-flow__minimap) {
		opacity: 0.45;
		transition: opacity 150ms ease;
	}

	.skill-flow :global(.svelte-flow__minimap:hover) {
		opacity: 1;
	}

	.skill-flow :global(.svelte-flow__minimap-node) {
		fill: var(--dash-text-muted);
	}

	.skill-flow :global(.svelte-flow__minimap-mask) {
		fill: var(--dash-bg-inset);
		fill-opacity: 0.6;
	}

	/* Nothing here is draggable, so the grab cursor would be a lie. */
	.skill-flow :global(.svelte-flow__node) {
		cursor: default;
	}
</style>
