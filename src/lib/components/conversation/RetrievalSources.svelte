<script lang="ts">
	/**
	 * What a generated turn was built from, under the turn itself.
	 *
	 * Retrieval decides which of the applicant's projects, stories and past
	 * application writing a draft stands on, and before this the decision was
	 * invisible: a draft that leaned on the wrong project looked exactly like a
	 * draft that was simply bad, and there was nothing on the page to act on.
	 *
	 * Two audiences, one record:
	 *  - The APPLICANT gets names and links. That is enough to tell "it used the
	 *    wrong project" from "it used the right one badly", and it is the most
	 *    honest place to say that writing from their OTHER applications is being
	 *    drawn on.
	 *  - STAFF additionally get `retrieval`: scores, which ranker chose each pick,
	 *    what was requested and dropped for budget. Server-gated — the prop is
	 *    simply absent for everyone else (see isStaffViewer), so none of it is
	 *    shipped to a page that will not show it.
	 *
	 * The EMPTY case renders too, and deliberately. "We looked through your
	 * projects and stories and nothing fit this question" is the single strongest
	 * argument for filling the profile in, and it is exactly what an
	 * only-render-when-there-are-items check would hide.
	 *
	 * CROWDED OUT is its own third state and must not be folded into empty. On a
	 * real application here, a 21.6k-char job description filled a 24k evidence
	 * budget by itself and every ranked source was dropped after finding nine
	 * genuine matches. "Nothing in your profile matched" would have been the exact
	 * opposite of the truth.
	 */
	import { resolve } from '$app/paths';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faChevronDown, faChevronUp, faLayerGroup } from '@fortawesome/free-solid-svg-icons';
	import type { RetrievalMention, RetrievalRecord } from '$lib/server/documents/retrieval-record';
	import { describeVia, formatRetrievalScore } from '$lib/retrieval-display';

	let {
		sources = [],
		empty = false,
		crowdedOut = false,
		retrieval = null
	}: {
		/** What this turn drew on, best-first. */
		sources?: RetrievalMention[];
		/** Retrieval ran and matched nothing — not the same as never running. */
		empty?: boolean;
		/** Retrieval matched, and the budget left no room for any of it. */
		crowdedOut?: boolean;
		/** The whole record. Staff only; absent means "not this viewer". */
		retrieval?: RetrievalRecord | null;
	} = $props();

	let expanded = $state(false);

	/** What each retrieved thing is, in the applicant's words rather than ours. */
	const KIND_LABELS: Record<string, string> = {
		side_project: 'Project',
		work_experience_project: 'Project',
		story: 'Story',
		app_letter: 'Past cover letter',
		app_answer: 'Past answer'
	};
	const kindLabel = (kind: string) => KIND_LABELS[kind] ?? 'Reference';

	/**
	 * Where a retrieved thing lives. Resolved here, from ids, rather than read
	 * back as a stored path: the record outlives the routes, so a URL written
	 * into a row months ago is a 404 the day a page moves, while a route id that
	 * stops existing is a build error.
	 *
	 * Undefined for anything whose page needs a parent id the record does not
	 * carry — an unlinked name beats a broken link.
	 */
	function linkFor(item: RetrievalMention): string | undefined {
		const id = String(item.id);
		switch (item.kind) {
			case 'side_project':
				return resolve('/(app)/profile/(data)/side-projects/[id]', { id });
			case 'work_experience_project':
				return item.parentId === undefined
					? undefined
					: resolve('/(app)/profile/(data)/work-experience/[id]/projects/[pid]', {
							id: String(item.parentId),
							pid: id
						});
			case 'story':
				return resolve('/(app)/applications/interview/stories/[id]', { id });
			case 'app_letter':
				return item.parentId === undefined
					? undefined
					: resolve('/(app)/applications/[id]/texts/[letterId]', {
							id: String(item.parentId),
							letterId: id
						});
			case 'app_answer':
				return item.parentId === undefined
					? undefined
					: resolve('/(app)/applications/[id]/texts/questions/[qid]', {
							id: String(item.parentId),
							qid: id
						});
			default:
				return undefined;
		}
	}

	// Nothing to say at all: this turn never retrieved (a manual edit, an outside
	// agent's revision, or a draft written before any of this was recorded).
	// Silence is right — an empty box would claim a lookup that never happened.
	let show = $derived(sources.length > 0 || empty || crowdedOut);

	let summary = $derived(sources.map((s) => s.title).join(' · '));

	/**
	 * The headline, which is the whole of what most people read. Three states,
	 * kept apart on purpose: "nothing matched" and "plenty matched and none of it
	 * fit" point at opposite fixes.
	 */
	let headline = $derived(
		sources.length > 0
			? null
			: empty
				? 'Nothing in your profile matched this. Adding projects, stories or documents gives the AI something of your own to build on.'
				: 'Your profile had relevant material for this, but the job posting is long enough that there was no room left for it in this draft.'
	);

	// Staff can open a turn that retrieved nothing — that is the turn whose record
	// they most need, since the reason it came back empty is exactly what the
	// detail explains.
	let canExpand = $derived(sources.length > 0 || !!retrieval);
</script>

<!-- The single anchor below takes its href from linkFor(), which builds every
     path with resolve(). The rule only recognises resolve() written inline in
     the attribute, and inlining it would mean repeating the five-way switch in
     markup, so it is disabled here rather than the paths being hand-built. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
{#if show}
	<div class="ml-6 text-xs text-[var(--dash-text-muted)]">
		{#snippet head()}
			<FontAwesomeIcon icon={faLayerGroup} class="mt-0.5 h-2.5 w-2.5 flex-shrink-0" />
			<span class="min-w-0 flex-1">
				{#if headline}
					{headline}
				{:else}
					<span class="text-[var(--dash-text-secondary)]">Based on:</span>
					<span class={expanded ? '' : 'line-clamp-1'}>{summary}</span>
				{/if}
			</span>
			{#if canExpand}
				<FontAwesomeIcon
					icon={expanded ? faChevronUp : faChevronDown}
					class="mt-0.5 h-2.5 w-2.5 flex-shrink-0"
				/>
			{/if}
		{/snippet}

		<!-- A real <button type="button">, not a clickable div: this sits inside the
		     editor's forms, and a typeless button submits them. -->
		{#if canExpand}
			<button
				type="button"
				onclick={() => (expanded = !expanded)}
				class="flex w-full items-start gap-1.5 text-left transition-colors hover:text-[var(--dash-text-secondary)]"
			>
				{@render head()}
			</button>
		{:else}
			<div class="flex w-full items-start gap-1.5">{@render head()}</div>
		{/if}

		{#if expanded && sources.length > 0}
			<ul class="mt-1.5 ml-4 space-y-1">
				{#each sources as item, i (i)}
					{@const href = linkFor(item)}
					<li class="flex flex-wrap items-baseline gap-x-1.5">
						<span class="text-[var(--dash-text-muted)]">{kindLabel(item.kind)}:</span>
						{#if href}
							<a
								{href}
								class="text-[var(--dash-text-secondary)] underline decoration-dotted underline-offset-2 hover:text-[var(--dash-text)]"
							>
								{item.title}
							</a>
						{:else}
							<span class="text-[var(--dash-text-secondary)]">{item.title}</span>
						{/if}
						{#if item.context}
							<span class="text-[var(--dash-text-muted)]">({item.context})</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		<!-- Staff detail. Everything quantitative lives here and nowhere else: to
		     the applicant a cosine of 0.61 is noise, and to us it is the difference
		     between a ranker that worked and one that never ran. -->
		{#if expanded && retrieval}
			<div class="mt-2 ml-4 space-y-1 border-l border-[var(--dash-border)] pl-2">
				<p class="font-medium text-[var(--dash-text-secondary)]">Retrieval (staff)</p>
				{#if retrieval.items.length > 0}
					<ul class="space-y-0.5">
						{#each retrieval.items as item, i (i)}
							<li class="font-mono">
								{item.source}/{item.kind}#{item.id} · {describeVia(item)} · {formatRetrievalScore(
									item
								)}
							</li>
						{/each}
					</ul>
				{/if}
				<p class="font-mono">
					rankers: {Object.entries(retrieval.rankers)
						.map(([s, r]) => `${s}=${r}`)
						.join(', ') || 'none'}
				</p>
				{#if retrieval.empty.length > 0}
					<p class="font-mono">looked, found nothing: {retrieval.empty.join(', ')}</p>
				{/if}
				{#if retrieval.dropped.length > 0}
					<p class="font-mono text-[var(--dash-error)]">
						dropped for budget: {retrieval.dropped.join(', ')}
					</p>
				{/if}
				<p class="font-mono">
					chars: {Object.entries(retrieval.chars)
						.map(([s, n]) => `${s}=${n}`)
						.join(', ') || 'none'} · profile={retrieval.profileChars} · budget={retrieval.budgetChars}
				</p>
				{#if retrieval.query}
					<p class="font-mono break-all">
						query: {retrieval.query.text}{retrieval.query.skills?.length
							? ` [${retrieval.query.skills.join(', ')}]`
							: ''}
					</p>
				{/if}
			</div>
		{/if}
	</div>
{/if}
