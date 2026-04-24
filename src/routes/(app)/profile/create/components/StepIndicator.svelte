<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCheck } from "@fortawesome/free-solid-svg-icons";

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
              h-0.5 w-4 sm:w-8 mx-1 sm:mx-2 {isCompleted || isCurrent
              ? 'bg-[var(--dash-primary)]'
              : 'bg-[var(--dash-border)]'}
            "
          >
          </div>
        {/if}

        <div class="flex flex-col items-center gap-0.5 sm:gap-1">
          <div
            class="
              flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-medium transition-colors
              {isCompleted
              ? 'bg-[var(--dash-primary)] text-white'
              : isCurrent
              ? 'bg-[var(--dash-primary)] text-white'
              : 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}
            "
          >
            {#if isCompleted}
              <FontAwesomeIcon
                icon={faCheck}
                class="w-3 h-3 sm:w-4 sm:h-4"
              />
            {:else}
              {stepNum}
            {/if}
          </div>
          <span
            class="
              text-[10px] sm:text-xs whitespace-nowrap {isCurrent
              ? 'text-[var(--dash-text)] font-medium'
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
