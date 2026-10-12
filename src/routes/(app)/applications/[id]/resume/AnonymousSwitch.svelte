<script lang="ts">
	/**
	 * Whether this application is read without the applicant's name.
	 *
	 * Saved the moment it changes, because saving is what makes the stored PDF
	 * anonymous: the action renders this application's version again (see
	 * `setAnonymous`), and until it has, the file one link away still names
	 * them. The spinner stays up for that whole render.
	 */
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCircleCheck,
		faCircleNotch,
		faTriangleExclamation
	} from '@fortawesome/free-solid-svg-icons';
	import { ANONYMOUS_DESCRIPTION, LEAK_LABELS, type LeakHit } from '$lib/resume-anonymity';

	let {
		anonymous,
		sending = null,
		hits = null
	}: {
		/** Whether this application is marked as read without names. */
		anonymous: boolean;
		/**
		 * The document this application records it is sending; null when none is.
		 * `fromLibrary` is a library version, as opposed to the plain document.
		 */
		sending?: { label: string; anonymous: boolean; fromLibrary: boolean } | null;
		/**
		 * What the stored PDF of that document still says about who they are,
		 * read from the file (server/profile/anonymity-check.ts). Null when there
		 * was no file to read.
		 */
		hits?: LeakHit[] | null;
	} = $props();

	let saving = $state(false);

	// Where they live is a separate question from who they are: see the note.
	let leaks = $derived((hits ?? []).filter((hit) => hit.kind !== 'hometown'));
	let towns = $derived((hits ?? []).filter((hit) => hit.kind === 'hometown'));

	/** The hit's words inside the text around them, to mark where to look. */
	function around(hit: LeakHit): [string, string, string] {
		const at = hit.context.indexOf(hit.term);
		if (at < 0) return [hit.context, '', ''];
		return [hit.context.slice(0, at), hit.term, hit.context.slice(at + hit.term.length)];
	}
</script>

<form
	method="POST"
	action="?/setAnonymous"
	use:enhance={() => {
		saving = true;
		return async ({ update }) => {
			await update({ reset: false });
			saving = false;
		};
	}}
>
	<label class="flex cursor-pointer items-start gap-2 text-sm text-[var(--dash-text)]">
		<input
			type="checkbox"
			name="anonymous"
			checked={anonymous}
			disabled={saving}
			onchange={(e) => e.currentTarget.form?.requestSubmit()}
			class="mt-0.5 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
		/>
		<span>
			<span class="font-medium">Anonymous application</span>
			{#if saving}
				<span class="ml-1 text-xs text-[var(--dash-text-secondary)]">
					<FontAwesomeIcon icon={faCircleNotch} spin class="h-3 w-3" />
					Making the PDF again…
				</span>
			{/if}
			<span class="mt-0.5 block text-xs text-[var(--dash-text-secondary)]">
				For an employer that reads applications without names. {ANONYMOUS_DESCRIPTION}
				{#if anonymous}
					Send them the PDF rather than a link: a link's address carries your name.
				{/if}
			</span>
		</span>
	</label>
</form>

{#snippet hitList(list: LeakHit[], labelled = true)}
	<ul class="mt-2 space-y-1.5 pl-5">
		{#each list as hit, i (i)}
			{@const [before, found, after] = around(hit)}
			<li class="text-xs text-[var(--dash-text-secondary)]">
				{#if labelled}
					<span class="font-medium text-[var(--dash-text)]">{LEAK_LABELS[hit.kind]}:</span>
				{/if}
				{before}<mark class="rounded bg-amber-500/20 px-0.5 text-[var(--dash-text)]">{found}</mark
				>{after}
			</li>
		{/each}
	</ul>
{/snippet}

{#if anonymous && sending?.anonymous && !saving}
	{#if hits === null}
		<p class="mt-2 text-xs text-[var(--dash-text-secondary)]">
			The PDF hasn't been read yet. Make it with the PDF button above and it is checked here.
		</p>
	{:else if leaks.length === 0}
		<p class="mt-2 flex items-center gap-1.5 text-xs text-[var(--dash-success)]">
			<FontAwesomeIcon icon={faCircleCheck} class="h-3 w-3" />
			Checked the PDF: nothing in it names you.
		</p>
		{#if towns.length > 0}
			<!-- Where they live is worth a look, not a verdict: an employer can be
			     in the same town, and then it belongs on the page. -->
			<div class="mt-1 text-xs text-[var(--dash-text-secondary)]">
				Your home town is on it {towns.length === 1 ? 'once' : `${towns.length} times`}, which is
				fine where it's an employer's:
				{@render hitList(towns, false)}
			</div>
		{/if}
	{:else}
		<div class="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
			<p class="flex items-start gap-2 text-xs text-[var(--dash-text)]">
				<FontAwesomeIcon
					icon={faTriangleExclamation}
					class="mt-0.5 h-3 w-3 shrink-0 text-amber-600"
				/>
				<span>
					The PDF still names you in {leaks.length === 1 ? 'one place' : `${leaks.length} places`}.
					Change those lines on your profile, or leave them off this job's version, and make the PDF
					again.
				</span>
			</p>
			{@render hitList([...leaks, ...towns])}
		</div>
	{/if}
{/if}

{#if anonymous && sending && !sending.anonymous}
	<div class="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
		<p class="flex items-start gap-2 text-xs text-[var(--dash-text)]">
			<FontAwesomeIcon
				icon={faTriangleExclamation}
				class="mt-0.5 h-3 w-3 shrink-0 text-amber-600"
			/>
			{#if sending.fromLibrary}
				<span>
					You're sending {sending.label}, a version from your library, and it prints your name.
					Tailor a version for this job, or make {sending.label} anonymous in Resumes &amp; CVs.
				</span>
			{:else}
				<span>
					You're sending {sending.label}, which prints your name. Tailor a version for this job to
					send it anonymously.
				</span>
			{/if}
		</p>
	</div>
{/if}
