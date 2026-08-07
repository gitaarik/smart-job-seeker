<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import type { IconProp } from '@fortawesome/fontawesome-svg-core';

	interface Props {
		icon: IconProp;
		href?: string;
		title?: string;
	}

	let { icon, href = '', title = '' }: Props = $props();

	let elLink: HTMLElement;

	function handleClick() {
		elLink.blur();
	}
</script>

<a
	{href}
	target="_blank"
	{title}
	class="focus:text-aqua flex items-center justify-end gap-2 text-nowrap transition hover:text-white hover:underline"
	bind:this={elLink}
	onclick={handleClick}
>
	<FontAwesomeIcon {icon} {title} class="w-3 transition hover:text-white focus:text-white" />

	<span>
		{title}
	</span>
</a>
