<script lang="ts">
	let {
		options,
		value = $bindable(''),
		disabled = false,
		onchange
	}: {
		options: { value: string; label: string }[];
		value: string;
		disabled?: boolean;
		onchange?: (value: string) => void;
	} = $props();

	function select(v: string) {
		value = v;
		onchange?.(v);
	}
</script>

<div class="flex flex-wrap gap-x-4 gap-y-2 {disabled ? 'pointer-events-none opacity-50' : ''}">
	{#each options as option}
		<label class="flex cursor-pointer items-center gap-1.5 text-sm text-[var(--dash-text)]">
			<input
				type="radio"
				checked={value === option.value}
				onchange={() => select(option.value)}
				{disabled}
				class="border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
			/>
			{option.label}
		</label>
	{/each}
</div>
