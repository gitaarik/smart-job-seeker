<script lang="ts">
	interface Props {
		tech: Record<string, string>;
	}

	let { tech }: Props = $props();
</script>

<li
	class="border-aqua bg-mist hover:bg-ice rounded border px-2 py-1 text-sm print:px-[6px] print:py-[4px]"
>
	{tech}
</li>
