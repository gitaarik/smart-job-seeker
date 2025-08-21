<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import EmploymentSection from "./EmploymentSection.svelte";
  import { resume } from "$lib/data/resume";

  import { faGlobe } from "@fortawesome/free-solid-svg-icons";

  // Format date range from JSON Resume format (YYYY-MM) to readable format
  function formatPeriod(startDate: string, endDate: string) {
    const start = new Date(startDate + "-01");
    const end = endDate ? new Date(endDate + "-01") : null;

    const startMonth = start.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });
    const endMonth = end
      ? end.toLocaleString("en-US", { month: "long", year: "numeric" })
      : "Present";

    return `${startMonth} – ${endMonth}`;
  }
</script>

<ResumeSection title="Professional Experience" icon={faGlobe}>
  {#each resume.work as work, index (work.name)}
    <EmploymentSection
      data={work}
      isFirst={index === 0}
    />
    {#if index < resume.work.length - 1}
      <hr class="border-cloud my-12 print:hidden" />
      <div class="hidden print:block print:break-before-page"></div>
    {/if}
  {/each}
</ResumeSection>
