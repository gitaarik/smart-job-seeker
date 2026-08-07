<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck } from '@fortawesome/free-solid-svg-icons';

	interface Props {
		currentStep: number;
		steps: string[];
	}

	let { currentStep, steps }: Props = $props();
</script>

<nav aria-label="Progress" class="mb-4 sm:mb-6">
	<ol class="flex items-center justify-center gap-1 sm:gap-2">
		{#each steps as step, index}
			{@const stepNum = index + 1}
			{@const isCompleted = stepNum < currentStep}
			{@const isCurrent = stepNum === currentStep}

			<li class="flex items-center">
				{#if index > 0}
					<div
						class="
              mx-1 h-0.5 w-4 sm:mx-2 sm:w-8 {isCompleted || isCurrent
							? 'bg-[var(--dash-primary)]'
							: 'bg-[var(--dash-border)]'}
            "
					></div>
				{/if}

				<div class="flex flex-col items-center gap-0.5 sm:gap-1">
					<div
						class="
              flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors sm:h-8 sm:w-8 sm:text-sm
              {isCompleted
							? 'bg-[var(--dash-primary)] text-white'
							: isCurrent
								? 'bg-[var(--dash-primary)] text-white'
								: 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}
            "
					>
						{#if isCompleted}
							<FontAwesomeIcon icon={faCheck} class="h-3 w-3 sm:h-4 sm:w-4" />
						{:else}
							{stepNum}
						{/if}
					</div>
					<span
						class="
              text-[10px] whitespace-nowrap sm:text-xs {isCurrent
							? 'font-medium text-[var(--dash-text)]'
							: 'text-[var(--dash-text-muted)]'}
            "
					>
						{step}
					</span>
				</div>
			</li>
		{/each}
	</ol>
</nav>
