<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCheck } from "@fortawesome/free-solid-svg-icons";

  interface Props {
    currentStep: number;
    steps: string[];
  }

  let { currentStep, steps }: Props = $props();
</script>

<nav aria-label="Progress" class="mb-8">
  <ol class="flex items-center justify-center gap-2">
    {#each steps as step, index}
      {@const stepNum = index + 1}
      {@const isCompleted = stepNum < currentStep}
      {@const isCurrent = stepNum === currentStep}

      <li class="flex items-center">
        {#if index > 0}
          <div
            class="
              h-0.5 w-8 mx-2 {isCompleted || isCurrent
              ? 'bg-ocean'
              : 'bg-light'}
            "
          >
          </div>
        {/if}

        <div class="flex flex-col items-center gap-1">
          <div
            class="
              flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors
              {isCompleted
              ? 'bg-ocean text-pearl'
              : isCurrent
              ? 'bg-ocean text-pearl'
              : 'bg-light text-pearl'}
            "
          >
            {#if isCompleted}
              <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
            {:else}
              {stepNum}
            {/if}
          </div>
          <span
            class="
              text-xs whitespace-nowrap {isCurrent
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
