<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { faComments } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
</script>

<ResumeSection title="References" icon={faComments}>
  <p class="mb-6">
    To confirm my experience with full stack development in dynamic, agile and
    startup environments, my most recent employers are willing to provide
    references by telephone. Feel free to ask me for their contact details.
  </p>

  <div class="space-y-4">
    {#each resume.references as reference (reference.name)}
      <div class="border-l-4 border-ocean pl-4 py-2">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h4 class="font-semibold text-base print:text-sm">
              {reference.name}
            </h4>
            <p class="text-sm mt-1 italic">
              “{reference.reference}”
            </p>
          </div>
          {#if reference.logo}
            <div class="ml-4 flex-shrink-0">
              <img
                src={reference.logo}
                alt="{reference.name} Logo"
                class="h-20 w-auto border border-agua rounded"
              />
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</ResumeSection>
