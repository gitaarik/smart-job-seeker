<script lang="ts">
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faBoxArchive,
		faCircleNotch,
		faRotate,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import type { DocType } from '$lib/utils/profile-doc-url';

	/**
	 * What can be done to the tailored version as a whole: build it again, keep
	 * it as one of your own, or throw it away.
	 *
	 * Its own row above both views of the contents, because none of the three is
	 * about one item, and each used to sit somewhere different: Delete beside the
	 * send record when that record named the version and in the diff's header
	 * when it didn't, Regenerate at the bottom of the diff.
	 *
	 * The host page must expose `tailorVersion`, `promoteTailored` and
	 * `discardTailored`.
	 */
	let {
		tailored,
		versions,
		docType,
		changeCount,
		recordedHere,
		profileMovedOn = false,
		template = null,
		locale = null
	}: {
		tailored: { name: string; baseSlug?: string | null };
		versions: { slug: string; name: string }[];
		docType: DocType;
		/** How many changes deleting it throws away. */
		changeCount: number;
		/** Whether the send record names this version, which deleting it clears. */
		recordedHere: boolean;
		/**
		 * Whether the profile changed since a run last decided this document.
		 *
		 * Not a warning: what was added is already printing — the version is a
		 * sidecar of decisions over live data, not a snapshot. What is out of date
		 * is the deciding, and the page budget it was fitted to. Said here because
		 * the button that fixes it is right beside it.
		 */
		profileMovedOn?: boolean;
		/**
		 * The presentation this application records, in storage form (null is the
		 * built-in template / base English), carried back into a regeneration.
		 */
		template?: string | null;
		locale?: string | null;
	} = $props();

	// Follows the version's real base until the applicant overrides it — a plain
	// $state(...) would freeze whatever the first render saw and then ignore a
	// rebase after the page invalidates.
	let chosenBase = $state<string | null>(null);
	let baseSlug = $derived(chosenBase ?? tailored.baseSlug ?? '');
	let working = $state(false);
	/**
	 * Deleting destroys a generated version and every decision on it, and the
	 * only way back is another model call. One click is too few for that, and
	 * the notes list on this page already asks twice for the same reason.
	 */
	let confirmingDiscard = $state(false);

	function track() {
		working = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			working = false;
		};
	}
</script>

<!-- Above the contents rather than under them: Delete sat a screen and a half
     down once before, where nobody found it. -->
<div class="mt-3">
	{#if profileMovedOn}
		<p class="mb-2 text-[10px] text-[var(--dash-text-secondary)]">
			Your profile changed since this was built. New items already show, but the choices here don't
			know about them yet.
		</p>
	{/if}

	<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
		<form
			method="POST"
			action="?/tailorVersion"
			use:enhance={track}
			class="flex flex-wrap items-center gap-2"
		>
			<input type="hidden" name="doc_type" value={docType} />
			<!-- The presentation this application already records, carried back so
			     the run keeps it. `tailorVersion` reads both off the form and then
			     WRITES them to `cv_template_sent` / `cv_locale_sent`, so omitting
			     them was not a missing default — it reset the record to the plain
			     template in English on every regenerate, and rendered the PDF
			     there. The Citrus/Dutch file the row above links stayed on disk,
			     untouched and now stale, which is exactly what "I pressed
			     Regenerate and nothing happened" looks like. Empty is the storage
			     form of both defaults, which is what the action expects. -->
			<input type="hidden" name="template" value={template ?? ''} />
			<input type="hidden" name="locale" value={locale ?? ''} />
			<!-- The base is re-offered here, not frozen at creation: regenerating
			     against a different version of your own is the main reason to
			     regenerate at all, and the action moves the extension to match. -->
			<label for="tailor-rebase-slug" class="text-[10px] text-[var(--dash-text-secondary)]">
				Built on
			</label>
			<select
				id="tailor-rebase-slug"
				name="base_slug"
				value={baseSlug}
				onchange={(e) => (chosenBase = e.currentTarget.value)}
				class="rounded-md border border-[var(--dash-border)] px-2 py-1 text-xs focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
			>
				<option value="">Your plain {docType === 'cv' ? 'CV' : 'resume'}</option>
				{#each versions as v (v.slug)}
					<option value={v.slug}>{v.name}</option>
				{/each}
			</select>
			<button
				type="submit"
				disabled={working}
				title="Tailor it again. Your own choices stay as they are."
				class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-primary)] hover:underline disabled:opacity-70"
			>
				<FontAwesomeIcon icon={working ? faCircleNotch : faRotate} spin={working} class="h-3 w-3" />
				Regenerate
			</button>
		</form>

		<form method="POST" action="?/promoteTailored" use:enhance={track}>
			<input type="hidden" name="name" value={tailored.name} />
			<button
				type="submit"
				disabled={working}
				title="Keep this as one of your own versions, decisions and all"
				class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] disabled:opacity-70"
			>
				<FontAwesomeIcon icon={faBoxArchive} class="h-3 w-3" />
				Keep in my versions
			</button>
		</form>

		<button
			type="button"
			onclick={() => (confirmingDiscard = true)}
			disabled={working}
			title="Delete this tailored version"
			class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-error)] disabled:opacity-70"
		>
			<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
			Delete
		</button>
	</div>

	{#if confirmingDiscard}
		<div
			class="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--dash-error)]/30 bg-[var(--dash-error)]/5 p-3"
		>
			<p class="flex-1 text-xs text-[var(--dash-text)]">
				Delete this version and its {changeCount}
				{changeCount === 1 ? 'change' : 'changes'}? Your own versions and your profile stay as they
				are{recordedHere ? ", but the record of what you're sending clears with it" : ''}.
			</p>
			<form
				method="POST"
				action="?/discardTailored"
				use:enhance={() => {
					const done = track();
					confirmingDiscard = false;
					return done;
				}}
			>
				<button
					type="submit"
					disabled={working}
					class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--dash-error)] px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-70"
				>
					<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
					Delete it
				</button>
			</form>
			<button
				type="button"
				onclick={() => (confirmingDiscard = false)}
				class="text-xs text-[var(--dash-text-secondary)] hover:underline"
			>
				Cancel
			</button>
		</div>
	{/if}
</div>
