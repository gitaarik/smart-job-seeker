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
	import { faCircleNotch, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
	import { ANONYMOUS_DESCRIPTION } from '$lib/resume-anonymity';

	let {
		anonymous,
		sending = null
	}: {
		/** Whether this application is marked as read without names. */
		anonymous: boolean;
		/**
		 * The document this application records it is sending; null when none is.
		 * `fromLibrary` is a library version, as opposed to the plain document.
		 */
		sending?: { label: string; anonymous: boolean; fromLibrary: boolean } | null;
	} = $props();

	let saving = $state(false);
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
