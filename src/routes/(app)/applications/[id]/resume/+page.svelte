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

	/**
	 * What the save reported about the PDF it tried to render alongside it. The
	 * record is the point and is written either way; a failed render is worth a
	 * line, not a failed save — the Make-the-PDF button on the row is the retry.
	 */
	let pdfError = $derived(form && 'pdfError' in form ? (form.pdfError as string | null) : null);
</script>

{#if pdfError}
	<p
		class="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-[var(--dash-text)]"
	>
		{pdfError}
	</p>
{/if}

<DocumentForJob
	{app}
	versions={data.versions ?? []}
	tailored={data.tailored ?? null}
	profileMovedOn={data.profileMovedOn ?? false}
	decisions={data.decisions ?? []}
	gaps={data.gaps ?? []}
	items={data.items ?? []}
	coverage={data.coverage ?? {}}
	creditedNotNamed={data.creditedNotNamed ?? []}
	exclusions={data.exclusions ?? {}}
	outOfReach={data.outOfReach ?? {}}
	heldBackParents={data.heldBackParents ?? {}}
	defaultBase={data.defaultBase}
	templates={data.templates ?? []}
	availableLocales={data.availableLocales ?? []}
	pdfKeys={data.pdfKeys ?? []}
	{profileSlug}
	{lastRun}
	specWarning={data.specWarning ?? null}
	hasJob={!!app.job}
/>
