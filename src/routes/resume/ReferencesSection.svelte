<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { faComments } from "@fortawesome/free-solid-svg-icons";

  const references = [
    {
      name: "Michaël de Groot",
      company: "Founder of Chipta",
      logo: "/src/lib/images/company-logos/chipta-logo.png",
      note: "Former employer - willing to provide references by telephone",
    },
    {
      name: "Elmar Krack",
      company: "Co-founder of Tender-it",
      logo: "/src/lib/images/company-logos/tender-it-logo.png",
      note: "Former employer - willing to provide references by telephone",
    },
  ];
</script>

<ResumeSection title="References" icon={faComments}>
  <p class="mb-6">
    To confirm my experience with full stack development in dynamic, agile and
    startup environments, my most recent employers are willing to provide
    references by telephone. Feel free to ask me for their contact details.
  </p>

  <div class="space-y-4">
    {#each references as reference (reference.name)}
      <div class="border-l-4 border-cyan-700 pl-4 py-2">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h4 class="font-semibold text-base print:text-sm">{reference.name}</h4>
            <p class="text-cyan-700 font-medium mt-1">
              {reference.company}
            </p>
            <p class="text-sm mt-1">
              {reference.note}
            </p>
          </div>
          {#if reference.logo}
            <div class="ml-4 flex-shrink-0">
              <img
                src={reference.logo}
                alt="{reference.company} Logo"
                class="h-20 w-auto border border-gray-400 rounded"
              />
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</ResumeSection>
