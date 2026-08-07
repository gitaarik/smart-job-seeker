<script lang="ts">
	import SectionHeader from './SectionHeader.svelte';
	import type { IconProp } from '@fortawesome/fontawesome-svg-core';

	interface Props {
		title: string;
		icon: IconProp;
		class?: string;
	}

	let { title, icon, class: classNames = '' }: Props = $props();
</script>

<article
	class="bg-frost border-ocean break-inside-avoid rounded-xl border-[1.2px] p-6 print:border-0 print:bg-transparent print:p-0 {classNames}"
>
	<SectionHeader {title} {icon} />

	<slot />
</article>
