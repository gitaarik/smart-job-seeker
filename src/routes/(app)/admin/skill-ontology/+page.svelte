<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import { RELATION_GUIDE, verbFor } from './graph/graph-shared';
	import ConceptRelations, { type PanelConcept } from './ConceptRelations.svelte';
	import type { PendingRelation } from './+page.server';

	interface ImportPreview {
		have: { concepts: number; aliases: number; relations: number };
		concepts: number;
		aliases: number;
		relations: number;
		approved: number;
		orphans: { aliases: number; relations: number };
		collisions: { slug: string; aliasOf: string }[];
		collisionCount: number;
		sample: { concepts: string[]; aliases: string[]; relations: string[] };
	}

	let {
		data,
		form
	}: {
		data: PageData;
		form: {
			error?: string;
			importError?: string;
			preview?: ImportPreview;
			filename?: string;
			imported?: { concepts: number; aliases: number; relations: number };
			export?: string;
		} | null;
	} = $props();

	/**
	 * The chosen file, kept in the browser between preview and confirm.
	 *
	 * Deliberately not parked server-side. Holding a half-finished import in a
	 * session would mean a confirmation could apply something other than what was
	 * previewed, and the server re-plans on confirm anyway — so the browser
	 * simply sends the same file twice.
	 */
	let bundleFile = $state<FileList | null>(null);
	let importOpen = $state(false);

	/** The export action returns the JSON; turn it into a download once. */
	$effect(() => {
		if (!form?.export) return;
		const url = URL.createObjectURL(new Blob([form.export], { type: 'application/json' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = 'skill-ontology.json';
		a.click();
		URL.revokeObjectURL(url);
	});

	let relations = $derived(data.relations);
	let aliases = $derived(data.aliases);
	let stats = $derived(data.stats);

	// `superseded` proposals are pending in the table but not in the queue: an
	// approved edge already connects the same two concepts, either saying this
	// more precisely or saying the opposite. Neither answer is a decision.
	// Counting them as review makes the queue look like work.
	let open = $derived(relations.filter((r) => !r.approved && !r.rejected));
	let pendingRelations = $derived(open.filter((r) => !r.superseded));
	let supersededRelations = $derived(open.filter((r) => r.superseded));
	let approvedRelations = $derived(relations.filter((r) => r.approved));
	let rejectedRelations = $derived(relations.filter((r) => r.rejected));
	let pendingAliases = $derived(aliases.filter((a) => !a.approved && !a.rejected));
	let approvedAliases = $derived(aliases.filter((a) => a.approved));
	let rejectedAliases = $derived(aliases.filter((a) => a.rejected));

	/**
	 * The concept whose context is open, and the row it was opened from.
	 *
	 * Keyed by row rather than held once for the page, because the panel renders
	 * under the claim it explains: a queue this long re-sorts on every verdict,
	 * and context parked at the top would be about a row that has scrolled away.
	 *
	 * `counterpart` is the other end of that row, so the panel can lead with the
	 * pair's own history. It is dropped on a pivot, because one hop out you are
	 * no longer looking at that pair.
	 */
	let selected = $state<{
		rowId: number;
		concept: PanelConcept;
		counterpart: { id: number; label: string } | null;
	} | null>(null);

	function pick(r: PendingRelation, end: 'from' | 'to') {
		const concept =
			end === 'from'
				? { id: r.from_id, label: r.from_label, slug: r.from_slug }
				: { id: r.to_id, label: r.to_label, slug: r.to_slug };
		// Clicking the open concept again closes it, so the same button is the
		// toggle rather than sending you to the × in the corner.
		if (selected?.rowId === r.id && selected.concept.id === concept.id) {
			selected = null;
			return;
		}
		selected = {
			rowId: r.id,
			concept,
			counterpart:
				end === 'from' ? { id: r.to_id, label: r.to_label } : { id: r.from_id, label: r.from_label }
		};
	}

	function isOpen(r: PendingRelation, id: number): boolean {
		return selected?.rowId === r.id && selected.concept.id === id;
	}
</script>

<svelte:head><title>Skill ontology · Admin</title></svelte:head>

{#snippet action(act: string, id: number, label: string, kind: 'yes' | 'no' | 'flip')}
	<form method="POST" action={act} use:enhance>
		<input type="hidden" name="id" value={id} />
		<button
			class="rounded-md border px-2 py-1 text-xs whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[var(--dash-primary)] focus-visible:outline-none
				{kind === 'yes'
				? 'border-[var(--dash-success)] text-[var(--dash-success)] hover:bg-[var(--dash-success-bg)]'
				: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]'}"
		>
			{label}
		</button>
	</form>
{/snippet}

<!--
	The claim, with each concept a button onto everything else said about it.

	Both ends, not just the subject. Half the wrong edges in this queue are wrong
	because of the OBJECT — "Docker is a kind of Deployment" turns on what
	"Deployment" is for, and that is the end you cannot guess from the sentence.

	Dotted underline rather than a button that looks like one: there are two of
	these on every row of a hundred-row list, and rendering them as controls would
	make the queue read as a form instead of as a series of claims.
-->
{#snippet claim(r: PendingRelation, muted = false)}
	{#snippet end(id: number, label: string, quoted: boolean)}
		<button
			type="button"
			onclick={() => pick(r, id === r.from_id ? 'from' : 'to')}
			title="What else does the graph say about {label}?"
			class="underline decoration-dotted underline-offset-2 hover:text-[var(--dash-primary)]
				{isOpen(r, id)
				? 'text-[var(--dash-primary)] decoration-[var(--dash-primary)]'
				: 'decoration-[var(--dash-border)]'}"
		>
			{quoted ? `“${label}”` : label}
		</button>
	{/snippet}
	<span class={muted ? 'text-[var(--dash-text-secondary)]' : 'text-[var(--dash-text)]'}>
		{@render end(r.from_id, r.from_label, r.relation === 'covers')}
		{verbFor(r.relation)}
		{@render end(r.to_id, r.to_label, false)}
	</span>
{/snippet}

<!-- Rendered inside the `li` it belongs to, so the markup stays a valid list. -->
{#snippet context(r: PendingRelation)}
	{#if selected?.rowId === r.id}
		<ConceptRelations
			concept={selected.concept}
			counterpart={selected.counterpart}
			relations={data.relations}
			matching={data.matchingRelations}
			onpivot={(c) => (selected = { rowId: r.id, concept: c, counterpart: null })}
			onclose={() => (selected = null)}
		/>
	{/if}
{/snippet}

<div class="space-y-4">
	<div class="flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold text-[var(--dash-text)]">Skill ontology</h1>
			<p class="mt-1 text-sm text-[var(--dash-text-secondary)]">
				{stats.concepts} concepts · {stats.edges} approved relations · {stats.aliases} approved aliases.
				Nothing unapproved affects matching.
			</p>
		</div>
		<div class="flex shrink-0 gap-2">
			<form method="POST" action="?/exportOntology" use:enhance>
				<button
					type="submit"
					class="rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]"
				>
					Export
				</button>
			</form>
			<button
				type="button"
				onclick={() => (importOpen = !importOpen)}
				class="rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]"
			>
				Import
			</button>
			<a
				href={resolve('/admin/skill-ontology/graph/all')}
				class="rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]"
			>
				View graph
			</a>
		</div>
	</div>

	{#if importOpen || form?.preview || form?.importError || form?.imported}
		<!-- Two steps, and the split is the safety rather than a nicety: an import
		     carries `approved_at`, so one confirm dialog would let hundreds of
		     approvals through with nobody having seen a number. -->
		<div class="space-y-3 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] p-4">
			<div>
				<h2 class="text-sm font-semibold text-[var(--dash-text)]">Import a bundle</h2>
				<p class="mt-1 text-xs text-[var(--dash-text-secondary)]">
					Only ever adds. Existing concepts keep their labels, and existing aliases and edges are
					left alone, so running the same bundle twice changes nothing.
				</p>
			</div>

			<form method="POST" action="?/previewImport" enctype="multipart/form-data" use:enhance>
				<div class="flex flex-wrap items-center gap-2">
					<input
						type="file"
						name="bundle"
						accept="application/json,.json"
						bind:files={bundleFile}
						class="text-sm text-[var(--dash-text-secondary)]"
					/>
					<button
						type="submit"
						disabled={!bundleFile?.length}
						class="rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)] disabled:opacity-40"
					>
						Preview
					</button>
				</div>
			</form>

			{#if form?.importError}
				<p
					class="rounded-md border border-[var(--dash-danger)]/40 bg-[var(--dash-danger-light)] px-3 py-2 text-sm text-[var(--dash-danger)]"
				>
					{form.importError}
				</p>
			{/if}

			{#if form?.imported}
				<p
					class="rounded-md border border-[var(--dash-success)]/40 bg-[var(--dash-success-light)] px-3 py-2 text-sm text-[var(--dash-success)]"
				>
					Imported {form.imported.concepts} concepts, {form.imported.aliases} aliases and
					{form.imported.relations} relations. Run
					<code>scripts/audit-skill-ontology.ts</code> to confirm the graph did not contradict itself.
				</p>
			{/if}

			{#if form?.preview}
				{@const p = form.preview}
				<div class="space-y-2 rounded-md border border-[var(--dash-border)] p-3 text-sm">
					<p class="text-[var(--dash-text-secondary)]">
						This instance holds {p.have.concepts} concepts, {p.have.aliases} aliases and
						{p.have.relations} edges.
					</p>
					<ul class="space-y-0.5 text-[var(--dash-text)]">
						<li>Would add <strong>{p.concepts}</strong> concepts</li>
						<li>Would add <strong>{p.aliases}</strong> aliases</li>
						<li>Would add <strong>{p.relations}</strong> relations</li>
					</ul>

					{#if p.orphans.aliases + p.orphans.relations > 0}
						<p class="text-xs text-[var(--dash-text-muted)]">
							Skipping {p.orphans.aliases} alias(es) and {p.orphans.relations} edge(s) whose concepts
							are in neither the bundle nor this instance — the bundle is incomplete.
						</p>
					{/if}

					{#if p.sample.concepts.length || p.sample.aliases.length || p.sample.relations.length}
						<div class="text-xs text-[var(--dash-text-muted)]">
							{#if p.sample.concepts.length}<p>Concepts: {p.sample.concepts.join(', ')}…</p>{/if}
							{#if p.sample.aliases.length}<p>Aliases: {p.sample.aliases.join(', ')}…</p>{/if}
							{#if p.sample.relations.length}<p>Edges: {p.sample.relations.join(', ')}…</p>{/if}
						</div>
					{/if}

					{#if p.collisionCount > 0}
						<!-- Audit defect 1. The graph would assert both "same node" and
						     "two nodes", and which one a lookup finds comes down to UNION
						     order, so there is no confirm button for this case. -->
						<div
							class="rounded-md border border-[var(--dash-danger)]/40 bg-[var(--dash-danger-light)] px-3 py-2 text-[var(--dash-danger)]"
						>
							<p class="font-medium">
								Cannot import: {p.collisionCount} concept(s) are already an approved alias here.
							</p>
							<ul class="mt-1 space-y-0.5 text-xs">
								{#each p.collisions as c (c.slug)}
									<li>"{c.slug}" is an alias of "{c.aliasOf}"</li>
								{/each}
							</ul>
							<p class="mt-1 text-xs">
								Run <code>scripts/audit-skill-ontology.ts --merge-duplicates</code> first.
							</p>
						</div>
					{:else}
						{#if p.approved > 0}
							<!-- The consequential number. Everything the proposers write is
							     inert until reviewed; these rows are not. -->
							<p
								class="rounded-md border border-[var(--dash-warning-border)] bg-[var(--dash-warning-bg)] px-3 py-2 text-[var(--dash-text)]"
							>
								<strong>{p.approved}</strong> of these arrive already approved and take effect on
								the next match for <strong>every profile</strong>. That is right when bootstrapping
								from an instance you trust, and wrong otherwise.
							</p>
						{/if}
						<form method="POST" action="?/importOntology" enctype="multipart/form-data" use:enhance>
							<input type="file" name="bundle" bind:files={bundleFile} class="hidden" />
							<button
								type="submit"
								disabled={!bundleFile?.length}
								class="rounded-md bg-[var(--dash-primary)] px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-40"
							>
								Import {p.concepts + p.aliases + p.relations} rows
							</button>
						</form>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Not decoration. The confidence floor let through two edges scoring 0.90
	     and 0.95, so the numbers below are a sort order and never a verdict. -->
	<div
		class="rounded-lg border border-[var(--dash-warning-border)] bg-[var(--dash-warning-bg)] px-4 py-3 text-sm text-[var(--dash-text)]"
	>
		These relations are shared by <strong>every profile</strong> — approving a wrong one degrades matching
		for everyone, silently. And confidence is not accuracy: every wrong edge found so far scored 0.90
		or above. Read the sentence, not the number, and click either skill in it to see what else the graph
		already says about that concept — including what has been rejected around it, which is where the standard
		for these actually lives.
	</div>

	<!-- Collapsed by default: whoever works this queue daily does not need it, and
	     an explanation that shouts every visit stops being read. Open, it answers
	     the two questions every wrong edge so far came down to — which relation
	     is this, and does the left really imply the right. -->
	<details
		class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-4 py-3 text-sm"
	>
		<summary class="cursor-pointer font-medium text-[var(--dash-text)]">
			What the relations mean
		</summary>

		<p class="mt-3 text-[var(--dash-text-secondary)]">
			One test decides all of them: <strong class="text-[var(--dash-text)]"
				>if someone has the left skill, do they necessarily have the right one?</strong
			>
			If yes it is a match relation and the sentence should read true out loud. If no, it belongs in the
			picture only — <code>inDomain</code> or <code>related</code> — and the matcher will never walk it.
		</p>

		<dl class="mt-3 space-y-3">
			{#each RELATION_GUIDE as g (g.relation)}
				<div>
					<dt class="font-mono text-xs text-[var(--dash-text)]">{g.relation}</dt>
					<dd class="text-[var(--dash-text-secondary)]">
						{g.means} — <em>{g.example}</em>
						<br />
						<span class="text-xs">⚠ {g.trap}</span>
					</dd>
				</div>
			{/each}
		</dl>

		<p class="mt-3 text-xs text-[var(--dash-text-secondary)]">
			Two skills that merely feel connected — CSV, JSON, YAML — are usually better joined
			<strong class="text-[var(--dash-text)]">through a shared parent</strong>
			than to each other: <code>JSON is a kind of Data formats</code> says why they are related and stays
			one row per skill, where linking every pair grows with the square of the list.
		</p>

		<p class="mt-2 text-xs text-[var(--dash-text-secondary)]">
			Direction is the whole point. Arrows run from the specific thing to the general one and are
			only ever followed that way, so
			<code>Django cannot be used without Python</code> credits a Django CV with Python and never the
			reverse.
		</p>
	</details>

	{#if form?.error}
		<div
			class="rounded-lg border border-[var(--dash-error)] px-4 py-3 text-sm text-[var(--dash-error)]"
		>
			{form.error}
		</div>
	{/if}

	<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]">
		<h2
			class="border-b border-[var(--dash-border)] px-4 py-2.5 text-sm font-medium text-[var(--dash-text)]"
		>
			Pending relations
			{#if pendingRelations.length > 0}
				<span
					class="ml-2 rounded-full bg-[var(--dash-bg-inset)] px-2 py-0.5 text-xs font-normal text-[var(--dash-text-secondary)]"
					>{pendingRelations.length}</span
				>
			{/if}
		</h2>
		{#if supersededRelations.length > 0}
			<p class="px-4 pt-3 text-xs text-[var(--dash-text-secondary)]">
				{supersededRelations.length} more not shown: an approved edge already connects the same two concepts,
				in one direction or the other, so there is nothing left to decide.
			</p>
		{/if}
		{#if pendingRelations.length === 0}
			<p class="px-4 py-4 text-sm text-[var(--dash-text-muted)]">Nothing waiting.</p>
		{:else}
			<ul class="mt-2">
				{#each pendingRelations as r (r.id)}
					<li class="border-b border-[var(--dash-border)] last:border-0">
						<div class="flex items-center gap-2 px-4 py-2">
							<span class="flex-1 text-sm">
								{@render claim(r)}
								<span class="ml-2 text-xs text-[var(--dash-text-muted)]">
									{r.relation}{r.confidence != null ? ` · ${r.confidence.toFixed(2)}` : ''}
								</span>
							</span>
							{@render action('?/approveRelation', r.id, 'Approve', 'yes')}
							{@render action('?/flipRelation', r.id, 'Flip', 'flip')}
							{@render action('?/rejectRelation', r.id, 'Reject', 'no')}
						</div>
						{@render context(r)}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]">
		<h2
			class="border-b border-[var(--dash-border)] px-4 py-2.5 text-sm font-medium text-[var(--dash-text)]"
		>
			Pending aliases
			{#if pendingAliases.length > 0}
				<span
					class="ml-2 rounded-full bg-[var(--dash-bg-inset)] px-2 py-0.5 text-xs font-normal text-[var(--dash-text-secondary)]"
					>{pendingAliases.length}</span
				>
			{/if}
		</h2>
		<p class="px-4 pt-3 text-xs text-[var(--dash-text-secondary)]">
			An alias makes one concept answer for another in <em>both</em> directions at once — a larger claim
			than a relation, so there is no bulk path for these.
		</p>
		{#if pendingAliases.length === 0}
			<p class="px-4 py-4 text-sm text-[var(--dash-text-muted)]">Nothing waiting.</p>
		{:else}
			<ul class="mt-2">
				{#each pendingAliases as a (a.id)}
					<li
						class="flex items-center gap-2 border-b border-[var(--dash-border)] px-4 py-2 last:border-0"
					>
						<span class="flex-1 text-sm text-[var(--dash-text)]">
							“{a.alias}” is another way of writing <strong>{a.label}</strong>
						</span>
						{@render action('?/approveAlias', a.id, 'Approve', 'yes')}
						{@render action('?/rejectAlias', a.id, 'Reject', 'no')}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]">
		<h2
			class="border-b border-[var(--dash-border)] px-4 py-2.5 text-sm font-medium text-[var(--dash-text)]"
		>
			In use ({approvedRelations.length + approvedAliases.length})
		</h2>
		<p class="px-4 pt-3 text-xs text-[var(--dash-text-secondary)]">
			Revoking takes effect on the next match and puts the row back in the queue above, undecided —
			one click to undo. It does not delete the proposal; a deleted one comes straight back on the
			next pipeline run.
		</p>
		<ul class="mt-2 max-h-96 overflow-y-auto">
			{#each approvedRelations as r (r.id)}
				<li class="border-b border-[var(--dash-border)] last:border-0">
					<div class="flex items-center gap-2 px-4 py-1.5">
						<span class="flex-1 text-sm">{@render claim(r)}</span>
						{@render action('?/revokeRelation', r.id, 'Revoke', 'no')}
					</div>
					{@render context(r)}
				</li>
			{/each}
			{#each approvedAliases as a (a.id)}
				<li
					class="flex items-center gap-2 border-b border-[var(--dash-border)] px-4 py-1.5 last:border-0"
				>
					<span class="flex-1 text-sm text-[var(--dash-text)]">“{a.alias}” = {a.label}</span>
					{@render action('?/revokeAlias', a.id, 'Revoke', 'no')}
				</li>
			{/each}
		</ul>
	</div>

	<!-- Collapsed, because it is a record and not a queue — but it has to be here.
	     Reject is one click on a list of a hundred-odd rows, so the misclick is a
	     matter of time, and the row is otherwise unreachable outside SQL: the
	     proposer will not re-offer it, `ON CONFLICT DO NOTHING` leaves it alone. -->
	{#if rejectedRelations.length + rejectedAliases.length > 0}
		<details class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]">
			<summary
				class="cursor-pointer px-4 py-2.5 text-sm font-medium text-[var(--dash-text)] select-none"
			>
				Rejected ({rejectedRelations.length + rejectedAliases.length})
			</summary>
			<p
				class="border-t border-[var(--dash-border)] px-4 pt-3 text-xs text-[var(--dash-text-secondary)]"
			>
				Kept so the proposer cannot offer them again. Restoring returns one to the queue.
			</p>
			<ul class="mt-2 max-h-96 overflow-y-auto">
				{#each rejectedRelations as r (r.id)}
					<li class="border-b border-[var(--dash-border)] last:border-0">
						<div class="flex items-center gap-2 px-4 py-1.5">
							<span class="flex-1 text-sm">{@render claim(r, true)}</span>
							{@render action('?/restoreRelation', r.id, 'Restore', 'no')}
						</div>
						{@render context(r)}
					</li>
				{/each}
				{#each rejectedAliases as a (a.id)}
					<li
						class="flex items-center gap-2 border-b border-[var(--dash-border)] px-4 py-1.5 last:border-0"
					>
						<span class="flex-1 text-sm text-[var(--dash-text-secondary)]"
							>“{a.alias}” = {a.label}</span
						>
						{@render action('?/restoreAlias', a.id, 'Restore', 'no')}
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</div>
