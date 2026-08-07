<script lang="ts">
	interface Props {
		author: string;
	}

	let { author }: Props = $props();
</script>

<blockquote class="py-15 sm:text-lg">
	<p class="leading-6 tracking-[0.5px] italic sm:leading-8">
		“<slot />”
	</p>

	<p class="mt-4 text-right font-semibold">
		{author}
	</p>
</blockquote>
