<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faChevronDown, faChevronUp, faCode } from '@fortawesome/free-solid-svg-icons';
	import type { SkillCategory } from '$lib/server/resume/types';
	import Card from '../../../../components/Card.svelte';
	import SkillCategoriesEditor from '../../../../components/SkillCategoriesEditor.svelte';

	interface Props {
		skills: SkillCategory[];
	}

	let { skills = $bindable() }: Props = $props();

	let isExpanded = $state(false);

	let totalSkills = $derived(skills.reduce((sum, cat) => sum + cat.skills.length, 0));
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
				<FontAwesomeIcon icon={faCode} class="h-5 w-5 text-[var(--dash-primary)]" />
			</div>
			<span class="text-base font-semibold text-[var(--dash-text)]">Skills</span>
			<span class="text-sm text-[var(--dash-text-secondary)]">
				({skills.length} categories, {totalSkills} skills)
			</span>
		</div>
		<FontAwesomeIcon
			icon={isExpanded ? faChevronUp : faChevronDown}
			class="h-4 w-4 text-[var(--dash-text-muted)]"
		/>
	</button>

	{#if isExpanded}
		<div class="border-t border-[var(--dash-border)]">
			<SkillCategoriesEditor bind:categories={skills} compact />
		</div>
	{/if}
</Card>
