<script lang="ts">
	import Card from '../../../components/Card.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let query = $state(data.root?.label ?? '');

	/** Box geometry. Fixed rather than measured: the label is clipped to fit, so
	 *  a node is the same size everywhere and columns line up exactly. */
	const NODE_W = 168;
	const NODE_H = 40;
	const COL_GAP = 92;
	const ROW_GAP = 18;
	const PAD = 24;

	let suggestions = $derived(
		query.trim().length < 1
			? []
			: data.concepts
					.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()))
					.slice(0, 8)
	);

	/**
	 * One column per depth, left to right: children, the focused concept, then
	 * each level of ancestry.
	 *
	 * Deterministic on purpose — nodes are sorted by label within a column, so
	 * the same concept always renders identically and a screenshot is
	 * reproducible. A force simulation would look livelier and settle somewhere
	 * new every time.
	 */
	let layout = $derived.by(() => {
		const depths = [...new Set(data.nodes.map((n) => n.depth))].sort((a, b) => a - b);
		const byDepth = depths.map((d) =>
			data.nodes.filter((n) => n.depth === d).sort((a, b) => a.label.localeCompare(b.label))
		);
		const tallest = Math.max(1, ...byDepth.map((c) => c.length));
		const height = PAD * 2 + tallest * NODE_H + (tallest - 1) * ROW_GAP;
		const width = PAD * 2 + depths.length * NODE_W + Math.max(0, depths.length - 1) * COL_GAP;

		const pos = new Map<number, { x: number; y: number; label: string; depth: number }>();
		byDepth.forEach((col, ci) => {
			const colHeight = col.length * NODE_H + (col.length - 1) * ROW_GAP;
			const top = (height - colHeight) / 2;
			col.forEach((n, ri) => {
				pos.set(n.id, {
					x: PAD + ci * (NODE_W + COL_GAP),
					y: top + ri * (NODE_H + ROW_GAP),
					label: n.label,
					depth: n.depth
				});
			});
		});
		return { pos, width, height, depths };
	});

	/** Left edge of source to right edge of target, curved so crossings stay readable. */
	function path(fromId: number, toId: number): string {
		const a = layout.pos.get(fromId);
		const b = layout.pos.get(toId);
		if (!a || !b) return '';
		const x1 = a.x + NODE_W;
		const y1 = a.y + NODE_H / 2;
		const x2 = b.x;
		const y2 = b.y + NODE_H / 2;
		const mid = (x1 + x2) / 2;
		return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
	}

	function clip(label: string): string {
		return label.length > 22 ? label.slice(0, 21) + '…' : label;
	}
</script>

<svelte:head><title>Skill graph · Admin</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-6 p-4">
	<div class="flex items-baseline justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold">Skill graph</h1>
			<p class="text-base-content/70 mt-1 text-sm">
				What a profile listing this skill expands to. Approved edges only — the same traversal the
				matcher runs.
			</p>
		</div>
		<a href="/admin/skill-ontology" class="btn btn-sm btn-ghost">Review queue</a>
	</div>

	<Card>
		<label class="form-control w-full">
			<span class="label-text mb-1">Concept</span>
			<input
				class="input input-bordered w-full"
				placeholder="React, Django, PostgreSQL…"
				bind:value={query}
				autocomplete="off"
			/>
		</label>
		{#if suggestions.length > 0 && query.trim().toLowerCase() !== data.root?.label.toLowerCase()}
			<div class="mt-2 flex flex-wrap gap-2">
				{#each suggestions as s (s.id)}
					<a
						href="/admin/skill-ontology/graph?concept={encodeURIComponent(s.slug)}"
						class="btn btn-xs"
					>
						{s.label}
					</a>
				{/each}
			</div>
		{/if}
	</Card>

	{#if !data.root}
		<Card>
			<p class="text-base-content/60 text-sm">
				Pick a concept above. {data.concepts.length} in the vocabulary.
			</p>
		</Card>
	{:else if data.nodes.length <= 1}
		<Card>
			<p class="text-sm">
				<strong>{data.root.label}</strong> has no approved relations yet — it is in the vocabulary but
				connects to nothing, so it only ever matches its own name.
			</p>
		</Card>
	{:else}
		<Card>
			<div class="mb-3 flex flex-wrap items-center gap-4 text-xs">
				<span class="flex items-center gap-1.5">
					<span class="bg-primary inline-block h-2.5 w-2.5 rounded-sm"></span> focused
				</span>
				<span class="flex items-center gap-1.5">
					<span class="border-base-content/30 inline-block h-2.5 w-2.5 rounded-sm border"></span> reached
					(a job asking for this matches)
				</span>
				<span class="flex items-center gap-1.5">
					<svg width="22" height="8"
						><line x1="0" y1="4" x2="22" y2="4" stroke="currentColor" stroke-width="1.5" /></svg
					>
					is a kind of
				</span>
				<span class="flex items-center gap-1.5">
					<svg width="22" height="8"
						><line
							x1="0"
							y1="4"
							x2="22"
							y2="4"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-dasharray="3 2"
						/></svg
					>
					requires
				</span>
			</div>

			<div class="overflow-x-auto">
				<svg
					width={layout.width}
					height={layout.height}
					viewBox="0 0 {layout.width} {layout.height}"
					class="text-base-content"
					role="img"
					aria-label="Skill graph for {data.root.label}"
				>
					<defs>
						<marker
							id="arrow"
							viewBox="0 0 8 8"
							refX="7"
							refY="4"
							markerWidth="6"
							markerHeight="6"
							orient="auto"
						>
							<path d="M 0 1 L 7 4 L 0 7 z" fill="currentColor" opacity="0.45" />
						</marker>
					</defs>

					{#each data.edges as e (`${e.from_id}-${e.to_id}-${e.relation}`)}
						<path
							d={path(e.from_id, e.to_id)}
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							opacity="0.4"
							stroke-dasharray={e.relation === 'requires' ? '4 3' : undefined}
							marker-end="url(#arrow)"
						/>
					{/each}

					{#each data.nodes as n (n.id)}
						{@const p = layout.pos.get(n.id)}
						{#if p}
							<a href="/admin/skill-ontology/graph?concept={encodeURIComponent(n.slug)}">
								<rect
									x={p.x}
									y={p.y}
									width={NODE_W}
									height={NODE_H}
									rx="6"
									class={n.depth === 0 ? 'fill-primary' : 'fill-base-100'}
									stroke="currentColor"
									stroke-opacity={n.depth === 0 ? '0' : '0.25'}
								/>
								<text
									x={p.x + NODE_W / 2}
									y={p.y + NODE_H / 2 + 4}
									text-anchor="middle"
									class="text-[12px] {n.depth === 0
										? 'fill-primary-content font-semibold'
										: 'fill-base-content'}"
								>
									{clip(n.label)}
								</text>
							</a>
						{/if}
					{/each}
				</svg>
			</div>

			<p class="text-base-content/60 mt-3 text-xs">
				Listing <strong>{data.root.label}</strong> matches jobs asking for any of the
				{data.nodes.filter((n) => n.depth > 0).length} concept(s) to its right. Nothing to the left is
				implied — those are skills that reach <em>this</em> one.
			</p>
		</Card>
	{/if}
</div>
