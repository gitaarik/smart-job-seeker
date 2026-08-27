<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import { verbFor } from './graph/graph-shared';

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
	 * Rendered as a sentence, not as a row of columns.
	 *
	 * The judgement being asked for is "is this claim true", and a claim reads
	 * as a claim. `React | broader | JavaScript` invites scanning; "React is a
	 * kind of JavaScript" invites deciding — and direction, which is the thing
	 * most often wrong, is only legible in prose.
	 */
	/**
	 * The verb comes from `verbFor` so this page and the graph's relation picker
	 * cannot disagree about what an edge asserts. Hard-coding them here meant a
	 * relation added elsewhere fell through to `X — inDomain — Y`, which is a
	 * schema value shown to a person, not a sentence.
	 *
	 * `covers` quotes its subject because a compound entry's whole label is the
	 * thing: “Vitest / Jest” reads as two skills unless the quotes hold it
	 * together.
	 */
	function sentence(relation: string, from: string, to: string): string {
		const subject = relation === 'covers' ? `“${from}”` : from;
		return `${subject} ${verbFor(relation)} ${to}`;
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
		or above. Read the sentence, not the number.
	</div>

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
					<li
						class="flex items-center gap-2 border-b border-[var(--dash-border)] px-4 py-2 last:border-0"
					>
						<span class="flex-1 text-sm text-[var(--dash-text)]">
							{sentence(r.relation, r.from_label, r.to_label)}
							<span class="ml-2 text-xs text-[var(--dash-text-muted)]">
								{r.relation}{r.confidence != null ? ` · ${r.confidence.toFixed(2)}` : ''}
							</span>
						</span>
						{@render action('?/approveRelation', r.id, 'Approve', 'yes')}
						{@render action('?/flipRelation', r.id, 'Flip', 'flip')}
						{@render action('?/rejectRelation', r.id, 'Reject', 'no')}
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
				<li
					class="flex items-center gap-2 border-b border-[var(--dash-border)] px-4 py-1.5 last:border-0"
				>
					<span class="flex-1 text-sm text-[var(--dash-text)]"
						>{sentence(r.relation, r.from_label, r.to_label)}</span
					>
					{@render action('?/revokeRelation', r.id, 'Revoke', 'no')}
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
					<li
						class="flex items-center gap-2 border-b border-[var(--dash-border)] px-4 py-1.5 last:border-0"
					>
						<span class="flex-1 text-sm text-[var(--dash-text-secondary)]"
							>{sentence(r.relation, r.from_label, r.to_label)}</span
						>
						{@render action('?/restoreRelation', r.id, 'Restore', 'no')}
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
