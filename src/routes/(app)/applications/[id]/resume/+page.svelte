<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import DocumentForJob from './DocumentForJob.svelte';

	/**
	 * Choosing, checking and recording the document that goes to this job.
	 *
	 * Its own tab rather than a card on the Overview, for the reason the Texts
	 * tab is its own tab: it is a workspace for one artifact, used in bursts
	 * while preparing an application. Splitting it also takes the analysis off
	 * the Overview's load — coverage for every template x version pair, the
	 * match read, and the relevance scoring behind the exclusion warnings were
	 * all being computed to read a note.
	 *
	 * One card, not two. The page used to pair a version picker with a tailoring
	 * panel, which asked the same question twice from two directions; see
	 * DocumentForJob.
	 */
	let { data, form }: { data: PageData; form: ActionData } = $props();

	let app = $derived(data.application);
	// Narrowed rather than `as any` (which the Overview's copy of this line still
	// is, inside the lint baseline): the only thing wanted here is the slug.
	let profileSlug = $derived(
		(data as { selectedProfile?: { slug?: string | null } }).selectedProfile?.slug ?? undefined
	);

	/**
	 * What the run that just finished reported about itself — the page count it
	 * reached, and whether it had to rank by word overlap. Read off the action
	 * result rather than stored: both are facts about one render of a document
	 * that every later edit changes.
	 */
	let lastRun = $derived(
		form && 'tailored' in form && form.tailored
			? {
					ranker: form.tailored.ranker,
					targetPages: form.tailored.targetPages,
					pages: form.tailored.pages
				}
			: null
	);
</script>

<DocumentForJob
	{app}
	versions={data.versions ?? []}
	tailored={data.tailored ?? null}
	decisions={data.decisions ?? []}
	gaps={data.gaps ?? []}
	items={data.items ?? []}
	coverage={data.coverage ?? {}}
	creditedNotNamed={data.creditedNotNamed ?? []}
	exclusions={data.exclusions ?? {}}
	outOfReach={data.outOfReach ?? {}}
	heldBackParents={data.heldBackParents ?? {}}
	defaultBase={data.defaultBase}
	{profileSlug}
	{lastRun}
	hasJob={!!app.job}
/>
