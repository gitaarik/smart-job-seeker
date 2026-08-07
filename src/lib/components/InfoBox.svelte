<script lang="ts">
	interface Props {
		headerText?: string;
		class?: string;
	}

	let { headerText = '', class: classNames = '' }: Props = $props();
</script>

<div class="bg-ice rounded-lg {classNames} border-ocean overflow-hidden border-2 transition-colors">
	<h3 class="bg-ocean text-pearl px-4 py-2 font-medium transition-colors">
		{headerText}
	</h3>

	<slot />
</div>
