<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import type { IconProp } from '@fortawesome/fontawesome-svg-core';

	interface Props {
		title: string;
		icon: IconProp;
	}

	let { title, icon }: Props = $props();
</script>

<h2 class="border-ocean relative mb-5 border-b-2 pb-1">
	<span class="pr-12 text-xl font-semibold print:text-lg">{title}</span>
	<div class="absolute top-1 right-1">
		<FontAwesomeIcon {icon} size="lg" />
	</div>
</h2>
