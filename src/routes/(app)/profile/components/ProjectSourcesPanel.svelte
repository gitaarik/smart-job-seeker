<script lang="ts">
	/**
	 * The "Files & code" tab, for either kind of project.
	 *
	 * `ProjectDocuments` was already kind-agnostic; what was duplicated was
	 * everything around it — the heading, the explanation of what happens to an
	 * upload, and where in the page it sat. The two pages had drifted: a side
	 * project kept it in a card of its own while a role project had it under a
	 * label inside an accordion row, so the same feature was described twice, in
	 * two voices, in two places. It is described here.
	 *
	 * It lives beside `ProjectDocuments` rather than in `$lib` because that is
	 * where `ProjectDocuments` and `ConfirmModal` already are, and a `$lib`
	 * component reaching back into `routes/` to import them would invert the one
	 * direction those imports have always run.
	 */
	import ProjectDocuments from './ProjectDocuments.svelte';

	interface DocRow {
		id: number;
		kind: string;
		title: string | null;
		original_filename: string | null;
		status: string;
		summary: string | null;
		keywords: unknown;
		skipped: unknown;
		file_count: number;
		total_bytes: number;
	}

	let {
		profileId,
		workExperienceProjectId = null,
		sideProjectId = null,
		repoUrl = null,
		documents
	}: {
		profileId: number;
		workExperienceProjectId?: number | null;
		sideProjectId?: number | null;
		/** Enables the repo scan. Both project kinds carry one. */
		repoUrl?: string | null;
		documents: DocRow[];
	} = $props();
</script>

<div>
	<h2 class="mb-1 text-lg font-semibold text-[var(--dash-text)]">Files & source code</h2>
	<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
		Anything that describes this project: its source, its docs, or a note you write yourself. We
		extract the text and summarize it into reference notes we can cite when a job matches — and the
		Details tab can propose a description, an outcome and technologies from it. Original files
		aren't stored and secrets are redacted.
	</p>
	<ProjectDocuments {profileId} {workExperienceProjectId} {sideProjectId} {repoUrl} {documents} />
</div>
