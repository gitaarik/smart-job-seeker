<script lang="ts">
	/**
	 * What a chip says about where its item is held back.
	 *
	 * Off both documents keeps the mark it always had: an eye-slash, with the
	 * chip dimmed by the caller. Off only some of the resume, the CV and the site
	 * gets a lighter one. Without it "not on my CV" showed nowhere until the chip
	 * was opened, and a role with thirty technologies is exactly where nobody
	 * opens them all to check. On every template, nothing.
	 *
	 * A list the documents never print, such as a project's technologies, is
	 * judged by the templates that do print it (`visibilityAmong`), so a chip
	 * kept off the site there reads as off everything, which it is.
	 *
	 * Shared by the skill chips and every list of technology chips, beside
	 * `ShowOnSwitches`, so the mark and the switches cannot disagree.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faEyeLowVision, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
	import {
		BASE_TEMPLATE_TAGS,
		DOCUMENT_TEMPLATE_TAGS,
		templateNames,
		visibilityAmong
	} from '$lib/profile-visibility';

	let {
		tags,
		templates = BASE_TEMPLATE_TAGS
	}: {
		tags: string[] | null | undefined;
		/** The base templates that print the item's list. */
		templates?: readonly string[];
	} = $props();

	let visibility = $derived(visibilityAmong(tags, templates));
	let printsDocuments = $derived(DOCUMENT_TEMPLATE_TAGS.every((t) => templates.includes(t)));
</script>

{#if visibility.off && printsDocuments}
	<span
		title="Profile-only — counts for matching, not shown on documents{visibility.hidden.includes(
			'portfolio'
		)
			? ' or the site'
			: ''}"
	>
		<FontAwesomeIcon icon={faEyeSlash} class="h-2.5 w-2.5 text-[var(--dash-text-muted)]" />
	</span>
{:else if visibility.off}
	<span title="Not on {templateNames(visibility.hidden, 'or')}: counts for job matching only">
		<FontAwesomeIcon icon={faEyeSlash} class="h-2.5 w-2.5 text-[var(--dash-text-muted)]" />
	</span>
{:else if visibility.hidden.length > 0}
	<span title="Not on {templateNames(visibility.hidden, 'or')}">
		<FontAwesomeIcon icon={faEyeLowVision} class="h-2.5 w-2.5 text-[var(--dash-text-muted)]" />
	</span>
{/if}
