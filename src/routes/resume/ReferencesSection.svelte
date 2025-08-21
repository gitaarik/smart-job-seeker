<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { faComments } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
</script>

<ResumeSection title="References" icon={faComments}>
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

  <p class="mt-4">
    {resume.referencesDescription}
  </p>
</ResumeSection>
