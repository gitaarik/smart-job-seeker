<script lang="ts">
	let {
		checked = $bindable(false),
		disabled = false,
		label = '',
		onchange
	}: {
		checked: boolean;
		disabled?: boolean;
		label?: string;
		onchange?: () => void;
	} = $props();
</script>

<label
	class="flex cursor-pointer items-center gap-1.5 text-sm text-[var(--dash-text)] {disabled
		? 'pointer-events-none opacity-50'
		: ''}"
>
	<input
		type="checkbox"
		bind:checked
		{disabled}
		{onchange}
		class="rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
	/>
	{#if label}{label}{/if}
</label>
