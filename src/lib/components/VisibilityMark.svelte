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
	 * Shared by the skill chips and a role's technology chips, beside
	 * `ShowOnSwitches`, so the mark and the switches cannot disagree.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faEyeLowVision, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
	import {
		BASE_TEMPLATE_TAGS,
		isHiddenFromDocuments,
		shownTemplates
	} from '$lib/profile-visibility';

	let { tags }: { tags: string[] | null | undefined } = $props();

	/** How the title names each base template. */
	const NAMES: Record<string, string> = {
		resume: 'the resume',
		cv: 'the CV',
		portfolio: 'the site'
	};

	let hidden = $derived.by(() => {
		const shown = shownTemplates(tags);
		return BASE_TEMPLATE_TAGS.filter((t) => !shown.includes(t));
	});
	let offDocuments = $derived(isHiddenFromDocuments(tags));
</script>

{#if offDocuments}
	<span
		title="Profile-only — counts for matching, not shown on documents{hidden.includes('portfolio')
			? ' or the site'
			: ''}"
	>
		<FontAwesomeIcon icon={faEyeSlash} class="h-2.5 w-2.5 text-[var(--dash-text-muted)]" />
	</span>
{:else if hidden.length > 0}
	<span title="Not on {hidden.map((t) => NAMES[t] ?? t).join(' or ')}">
		<FontAwesomeIcon icon={faEyeLowVision} class="h-2.5 w-2.5 text-[var(--dash-text-muted)]" />
	</span>
{/if}
