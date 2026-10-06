<script lang="ts" generics="U extends string">
	/** An ask: the amount, its currency and what it is per, read as one phrase. */
	import { currencyOptions, INPUT_CLASS, numberOrNull } from './salary-ui';

	interface Props {
		label: string;
		amount: number | null;
		currency: string;
		per: U;
		perOptions: { value: U; label: string }[];
		placeholder: string;
		onamount: (amount: number | null) => void;
		oncurrency: (currency: string) => void;
		onper: (per: U) => void;
	}

	let {
		label,
		amount,
		currency,
		per,
		perOptions,
		placeholder,
		onamount,
		oncurrency,
		onper
	}: Props = $props();
	const id = $props.id();
</script>

<div>
	<label
		for={id}
		class="mb-1.5 block text-xs font-medium tracking-wide text-[var(--dash-text-muted)] uppercase"
		>{label}</label
	>
	<div class="flex flex-wrap items-center gap-2">
		<input
			{id}
			type="number"
			min="0"
			step="1"
			value={amount ?? ''}
			{placeholder}
			oninput={(e) => onamount(numberOrNull(e.currentTarget.value))}
			class="{INPUT_CLASS} w-32 text-base font-semibold"
		/>
		<select
			value={currency}
			onchange={(e) => oncurrency(e.currentTarget.value)}
			aria-label="Currency"
			class={INPUT_CLASS}
		>
			{#each currencyOptions(currency) as code (code)}
				<option value={code}>{code}</option>
			{/each}
		</select>
		<select
			value={per}
			onchange={(e) => onper(e.currentTarget.value as U)}
			aria-label="Per"
			class={INPUT_CLASS}
		>
			{#each perOptions as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</div>
</div>
