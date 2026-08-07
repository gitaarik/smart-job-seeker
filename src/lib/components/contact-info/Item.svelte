<script lang="ts">
	interface Props {
		label: string;
	}

	let { label }: Props = $props();
</script>

<div class="flex whitespace-nowrap">
	<strong class="mr-2 sm:block sm:w-[130px] sm:text-right">{label}:</strong>
	<slot></slot>
</div>
