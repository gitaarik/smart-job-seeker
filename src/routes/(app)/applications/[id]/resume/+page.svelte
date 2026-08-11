<script lang="ts">
	import type { PageData } from './$types';
	import { recommendVersion } from '$lib/version-coverage';
	import CvSentCard from './CvSentCard.svelte';
	import TailoredVersionCard from './TailoredVersionCard.svelte';

	/**
	 * Choosing, checking and recording the document that goes to this job.
	 *
	 * Its own tab rather than a card on the Overview, for the reason the Texts
	 * tab is its own tab: it is a workspace for one artifact, used in bursts
	 * while preparing an application. Splitting it also takes the analysis off
	 * the Overview's load — coverage for every template x version pair, the
	 * match read, and the relevance scoring behind the exclusion warnings were
	 * all being computed to read a note.
	 */
	let { data }: { data: PageData } = $props();

	let app = $derived(data.application);
	// Narrowed rather than `as any` (which the Overview's copy of this line still
	// is, inside the lint baseline): the only thing wanted here is the slug.
	let profileSlug = $derived(
		(data as { selectedProfile?: { slug?: string | null } }).selectedProfile?.slug ?? undefined
	);

	// The tailored version answers for the document type actually recorded (or
	// the default), not for the unsaved picker: which base template a selection
	// was computed against is part of what it means.
	let tailorDocType: 'resume' | 'cv' = $derived(app.cv_sent_through === 'cv' ? 'cv' : 'resume');
	// Which library version to build on: the one the coverage ranking picks for
	// this job, else whatever this profile sends by default. Falling back to the
	// plain document would start from content with none of the applicant's
	// curation applied.
	let suggestedBaseSlug = $derived(
		recommendVersion(data.coverage ?? {}, tailorDocType, [
			'',
			...(data.versions ?? []).map((v) => v.slug)
		])?.versionSlug ??
			data.defaultBase?.[tailorDocType] ??
			''
	);
</script>

<div class="space-y-6">
	<CvSentCard
		{app}
		versions={data.versions ?? []}
		tailored={data.tailored ?? null}
		coverage={data.coverage ?? {}}
		creditedNotNamed={data.creditedNotNamed ?? []}
		exclusions={data.exclusions ?? {}}
		{profileSlug}
	/>

	<TailoredVersionCard
		tailored={data.tailored ?? null}
		decisions={data.decisions ?? []}
		gaps={data.gaps ?? []}
		versions={data.versions ?? []}
		docType={tailorDocType}
		{suggestedBaseSlug}
		{profileSlug}
		hasJob={!!app.job}
	/>
</div>
