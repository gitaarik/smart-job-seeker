<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faChevronDown,
		faChevronUp,
		faLanguage,
		faPlus,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import type { Language } from '$lib/server/resume/types';
	import Card from '../../../../components/Card.svelte';

	interface Props {
		languages: Language[];
	}

	let { languages = $bindable() }: Props = $props();

	let isExpanded = $state(false);

	function removeItem(index: number) {
		if (!confirm('Remove this language?')) return;
		languages = languages.filter((_, i) => i !== index);
	}

	function addLanguage() {
		languages = [...languages, { name: '' }];
		isExpanded = true;
	}

	const proficiencyOptions = [
		{ value: 'native', label: 'Native' },
		{ value: 'fluent', label: 'Fluent' },
		{ value: 'proficient', label: 'Proficient' },
		{ value: 'conversational', label: 'Conversational' },
		{ value: 'basic', label: 'Basic' }
	];
</script>

<Card class="overflow-hidden">
	<button
		type="button"
		onclick={() => (isExpanded = !isExpanded)}
		class="flex w-full items-center justify-between p-3 transition-colors hover:bg-[var(--dash-bg)] sm:p-4"
	>
		<div class="flex items-center gap-3">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--dash-primary)]/10"
			>
				<FontAwesomeIcon icon={faLanguage} class="h-5 w-5 text-[var(--dash-primary)]" />
			</div>
			<span class="text-base font-semibold text-[var(--dash-text)]">Languages</span>
			<span class="text-sm text-[var(--dash-text-secondary)]">({languages.length})</span>
		</div>
		<FontAwesomeIcon
			icon={isExpanded ? faChevronUp : faChevronDown}
			class="h-4 w-4 text-[var(--dash-text-muted)]"
		/>
	</button>

	{#if isExpanded}
		<div class="border-t border-[var(--dash-border)] p-3 sm:p-4">
			<div class="inline-flex flex-col gap-3">
				{#each languages as lang, index}
					<div class="flex items-center gap-3">
						<input
							type="text"
							bind:value={languages[index].name}
							placeholder="Language"
							class="w-48 rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>

						<select
							bind:value={languages[index].proficiency}
							class="rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						>
							<option value="">Proficiency</option>
							{#each proficiencyOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>

						<button
							type="button"
							onclick={() => removeItem(index)}
							class="p-2 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-error)]"
							aria-label="Remove language"
						>
							<FontAwesomeIcon icon={faTrash} class="h-4 w-4" />
						</button>
					</div>
				{/each}

				<button
					type="button"
					onclick={addLanguage}
					class="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--dash-border)] py-2 text-sm text-[var(--dash-primary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary-hover)]"
				>
					<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
					Add language
				</button>
			</div>
		</div>
	{/if}
</Card>
