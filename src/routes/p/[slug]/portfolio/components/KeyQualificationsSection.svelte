<script lang="ts">
	import InfoSection from './InfoSection.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faStar } from '@fortawesome/free-solid-svg-icons';
	import { getFaIcon } from '$lib/tools/fa-icons';

	let props = $props();
	const profile = props.profile;
</script>

<InfoSection title="Technical Highlights" icon={faStar}>
	<ul class="ml-1 space-y-4 print:space-y-2">
		{#each profile.highlights as highlight (highlight.text)}
			<li class="flex items-start">
				<FontAwesomeIcon icon={getFaIcon(highlight.fa_icon)} class="mt-1 mr-3 h-4 w-4" />
				<!-- Plain interpolation, not {@html}: this is user-authored profile text
				     rendered on a public page, and none of it carries markup (checked:
				     0 of 75 rows contain a tag or a ** pair). Svelte escapes this. -->
				<span>{highlight.text}</span>
			</li>
		{/each}
	</ul>
</InfoSection>
