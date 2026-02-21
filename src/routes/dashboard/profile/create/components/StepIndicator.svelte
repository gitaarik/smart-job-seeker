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
              ? 'bg-ocean'
              : 'bg-light'}
            "
          >
          </div>
        {/if}

        <div class="flex flex-col items-center gap-0.5 sm:gap-1">
          <div
            class="
              flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-medium transition-colors
              {isCompleted
              ? 'bg-ocean text-pearl'
              : isCurrent
              ? 'bg-ocean text-pearl'
              : 'bg-light text-pearl'}
            "
          >
            {#if isCompleted}
              <FontAwesomeIcon icon={faCheck} class="w-3 h-3 sm:w-4 sm:h-4" />
            {:else}
              {stepNum}
            {/if}
          </div>
          <span
            class="
              text-[10px] sm:text-xs whitespace-nowrap {isCurrent
              ? 'text-slate font-medium'
              : 'text-pearl'}
            "
          >
            {step}
          </span>
        </div>
      </li>
    {/each}
  </ol>
</nav>
