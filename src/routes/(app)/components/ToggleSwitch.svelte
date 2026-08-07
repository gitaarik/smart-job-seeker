<script lang="ts">
	let {
		checked = $bindable(false),
		disabled = false,
		label = '',
		description = ''
	}: {
		checked: boolean;
		disabled?: boolean;
		label?: string;
		description?: string;
	} = $props();
</script>

<label
	class="flex cursor-pointer items-center justify-between {disabled
		? 'pointer-events-none opacity-50'
		: ''}"
	class:gap-4={label || description}
>
	{#if label || description}
		<div>
			{#if label}
				<span class="font-medium text-[var(--dash-text)]">{label}</span>
			{/if}
			{#if description}
				<p class="mt-0.5 text-xs text-[var(--dash-text-muted)]">{description}</p>
			{/if}
		</div>
	{/if}
	<div class="relative shrink-0">
		<input type="checkbox" bind:checked {disabled} class="peer sr-only" />
		<div
			class="h-6 w-11 rounded-full bg-[var(--dash-border)] transition-colors peer-checked:bg-[var(--dash-primary)]"
		></div>
		<div
			class="absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
		></div>
	</div>
</label>
