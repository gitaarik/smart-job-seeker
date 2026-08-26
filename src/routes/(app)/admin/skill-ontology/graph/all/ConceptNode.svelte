<script module lang="ts">
	export interface ConceptNodeData extends Record<string, unknown> {
		label: string;
		slug: string;
		/** Index into the layout's `islands`, so hovering can dim the rest. */
		island: number;
	}
</script>

<script lang="ts">
	import { resolve } from '$app/paths';
	import { Handle, Position, useSvelteFlow, type Node, type NodeProps } from '@xyflow/svelte';
	import { getGraphHighlight } from './highlight.svelte';

	let { id, data }: NodeProps<Node<ConceptNodeData, 'concept'>> = $props();

	const hl = getGraphHighlight();
	const flow = useSvelteFlow();

	// Spelled out in the attribute rather than built in a $derived:
	// `svelte/no-navigation-without-resolve` can only see resolve() when the call
	// is in the href itself, and a derived string reads to it as a bare path.
	const GRAPH = resolve('/admin/skill-ontology/graph');

	const dimmed = $derived(hl.dimmed(data.island, data.label));
	const matched = $derived(hl.matches(data.label));

	// Focus mirrors hover deliberately: tabbing through the graph is a supported
	// way to read it, and highlighting only on pointer hover would make that path
	// strictly worse.
	const enter = () => (hl.hovered = data.island);
	const leave = () => (hl.hovered = null);

	/**
	 * Bring the node into view when it takes keyboard focus off-screen.
	 *
	 * Svelte Flow's `autoPanOnNodeFocus` sounds like it covers this and does not:
	 * it fires for focus on the node wrapper it owns, not for a link inside a
	 * custom node. Measured 2026-08-26 — zoomed to 1.45 and focused an off-screen
	 * anchor, the viewport transform did not change by a pixel, so tabbing walked
	 * off the edge of the canvas with nothing to show for it.
	 *
	 * Guarded on actually being outside, so the focus a mouse click brings with it
	 * never yanks the view.
	 */
	function reveal(event: FocusEvent) {
		enter();
		const el = event.currentTarget as HTMLElement;
		const box = el.closest('.svelte-flow__node')?.getBoundingClientRect();
		const pane = el.closest('.svelte-flow')?.querySelector('.svelte-flow__pane');
		if (!box || !pane) return;

		const view = pane.getBoundingClientRect();
		const inside =
			box.left >= view.left &&
			box.right <= view.right &&
			box.top >= view.top &&
			box.bottom <= view.bottom;
		if (inside) return;

		const node = flow.getNode(id);
		if (!node) return;
		flow.setCenter(
			node.position.x + (node.width ?? 0) / 2,
			node.position.y + (node.height ?? 0) / 2,
			{ zoom: flow.getZoom(), duration: 200 }
		);
	}

	const classes = $derived(
		[
			'flex h-full w-full items-center justify-center rounded-md border px-1.5 text-center',
			'text-[11px] leading-tight transition-all duration-150',
			'focus-visible:ring-2 focus-visible:ring-[var(--dash-primary)] focus-visible:outline-none',
			matched
				? 'border-[var(--dash-primary)] bg-[var(--dash-primary-light)] text-[var(--dash-primary)] ring-2 ring-[var(--dash-primary)]'
				: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)]',
			dimmed ? 'opacity-20' : 'opacity-100'
		].join(' ')
	);
</script>

<!--
	Handles are anchor points, not affordances: they are what the bezier attaches
	to, and they are invisible until step 2 turns on edge drawing. Target left and
	source right is not cosmetic — it is what makes every edge leave a node on the
	general side and arrive on the specific side, matching the layout's columns.
-->
<Handle type="target" position={Position.Left} isConnectable={false} />
<a
	href="{GRAPH}?concept={encodeURIComponent(data.slug)}"
	title={data.label}
	class={classes}
	onmouseenter={enter}
	onmouseleave={leave}
	onfocus={reveal}
	onblur={leave}
>
	<span class="line-clamp-2">{data.label}</span>
</a>
<Handle type="source" position={Position.Right} isConnectable={false} />
