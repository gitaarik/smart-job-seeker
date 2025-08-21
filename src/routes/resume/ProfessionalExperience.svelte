<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import EmploymentSection from "./EmploymentSection.svelte";
  import resume from "$lib/data/resume.json";

  import { faGlobe, faRocket } from "@fortawesome/free-solid-svg-icons";

  // Icon cache to prevent multiple imports of the same icon
  const iconCache: { string?: object } = {};

  // Dynamic icon import function with caching
  async function getIcon(iconName: string) {
    if (iconCache[iconName]) {
      return iconCache[iconName];
    }

    try {
      const icons = await import("@fortawesome/free-solid-svg-icons");
      const icon = icons[iconName] || faRocket; // fallback to faRocket if icon not found
      iconCache[iconName] = icon;
      return icon;
    } catch {
      iconCache[iconName] = faRocket; // cache fallback icon too
      return faRocket;
    }
  }

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

  // Collect all unique icons needed and pre-load them
  const uniqueIcons = [
    ...new Set(
      resume.work.flatMap((job) =>
        job.highlights?.map((highlight) => highlight.icon) || []
      ),
    ),
  ];

  // Pre-load all unique icons
  Promise.all(uniqueIcons.map((iconName) => getIcon(iconName)));

  // Add formatted period to each job for display
  const displayedJobs = resume.work.map((job) => ({
    ...job,
    period: formatPeriod(job.startDate, job.endDate),
    achievements: job.highlights?.map((highlight) => ({
      title: highlight.title,
      icon: iconCache[highlight.icon] || faRocket,
      description: highlight.description,
    })) || [],
    technologies: job.keywords || [],
  }));
</script>

<ResumeSection title="Professional Experience" icon={faGlobe}>
  {#each displayedJobs as job, index (job.name)}
    <EmploymentSection
      name={job.name}
      position={job.position}
      description={job.description}
      url={job.url}
      period={job.period}
      location={job.location}
      logo={job.logo}
      summary={job.summary}
      note={job.note}
      highlights={job.achievements}
      keywords={job.technologies}
      isFirst={index === 0}
    />
    {#if index < displayedJobs.length - 1}
      <hr class="border-cloud my-12 print:hidden" />
      <div class="hidden print:block print:break-before-page"></div>
    {/if}
  {/each}
</ResumeSection>
