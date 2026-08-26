<script lang="ts">
	import type { PageData } from './$types';

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

		const pos = new Map<number, { x: number; y: number }>();
		byDepth.forEach((col, ci) => {
			const colH = col.length * NODE_H + (col.length - 1) * ROW_GAP;
			const top = (height - colH) / 2;
			col.forEach((n, ri) => {
				pos.set(n.id, { x: PAD + ci * (NODE_W + COL_GAP), y: top + ri * (NODE_H + ROW_GAP) });
			});
		});
		return { pos, width, height };
	});

	function path(fromId: number, toId: number): string {
		const a = layout.pos.get(fromId);
		const b = layout.pos.get(toId);
		if (!a || !b) return '';
		const x1 = a.x + NODE_W;
		const y1 = a.y + NODE_H / 2;
		const x2 = b.x - 7; // stop short so the arrowhead does not sit under the box
		const y2 = b.y + NODE_H / 2;
		const mid = (x1 + x2) / 2;
		return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
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
		<a
			href="/admin/skill-ontology"
			class="shrink-0 rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]"
		>
			Review queue
		</a>
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
						href="/admin/skill-ontology/graph?concept={encodeURIComponent(s.slug)}"
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
			Pick a concept above. {data.concepts.length} in the vocabulary.
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
				<span class="flex items-center gap-1.5">
					<span class="h-2.5 w-2.5 rounded-sm bg-[var(--dash-primary)]"></span> focused
				</span>
				<span class="flex items-center gap-1.5">
					<span class="h-2.5 w-2.5 rounded-sm border border-[var(--dash-border)]"></span>
					reached — a job asking for this matches
				</span>
				<span class="flex items-center gap-1.5">
					<svg width="24" height="8" aria-hidden="true">
						<line x1="0" y1="4" x2="24" y2="4" stroke="currentColor" stroke-width="1.5" />
					</svg>
					is a kind of
				</span>
				<span class="flex items-center gap-1.5">
					<svg width="24" height="8" aria-hidden="true">
						<line
							x1="0"
							y1="4"
							x2="24"
							y2="4"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-dasharray="4 3"
						/>
					</svg>
					requires
				</span>
			</div>

			<div class="overflow-x-auto p-2">
				<div class="relative mx-auto" style="width:{layout.width}px; height:{layout.height}px;">
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
						{#each data.edges as e (`${e.from_id}-${e.to_id}-${e.relation}`)}
							<path
								d={path(e.from_id, e.to_id)}
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-dasharray={e.relation === 'requires' ? '4 3' : undefined}
								marker-end="url(#arrow)"
							/>
						{/each}
					</svg>

					{#each data.nodes as n (n.id)}
						{@const p = layout.pos.get(n.id)}
						{#if p}
							<a
								href="/admin/skill-ontology/graph?concept={encodeURIComponent(n.slug)}"
								title={n.label}
								class="absolute flex items-center justify-center rounded-md border px-2 text-center text-[13px] leading-tight transition-colors
									{n.depth === 0
									? 'border-[var(--dash-primary)] bg-[var(--dash-primary)] font-semibold text-white'
									: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)]'}"
								style="left:{p.x}px; top:{p.y}px; width:{NODE_W}px; height:{NODE_H}px;"
							>
								<span class="line-clamp-2">{n.label}</span>
							</a>
						{/if}
					{/each}
				</div>
			</div>

			<p
				class="border-t border-[var(--dash-border)] px-4 py-2.5 text-xs text-[var(--dash-text-secondary)]"
			>
				Listing <strong class="text-[var(--dash-text)]">{data.root.label}</strong> matches jobs
				asking for any of the {data.nodes.filter((n) => n.depth > 0).length} concept(s) to its right.
				Nothing to the left is implied — those are skills that reach <em>this</em> one.
			</p>
		</div>
	{/if}
</div>
