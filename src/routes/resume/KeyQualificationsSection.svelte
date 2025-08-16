<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import BulletList from "./BulletList.svelte";
  import BulletItem from "./BulletItem.svelte";

  const qualifications = [
    "<strong>18+ years</strong> of <strong>full stack development experience</strong>.",
    "Expertise in modern <strong>Python, JavaScript & Node.js</strong> ecosystems.",
    "Additional experience in <strong>Linux, DevOps & CI/CD.</strong>",
    "<strong>Team leadership</strong> and <strong>project management</strong> experience.",
    "Skilled in <strong>AI-accelerated development</strong>, with business security in mind.",
    "<strong>5+ years remote work</strong> and distributed team collaboration experience.",
    "Proven track record scaling <strong>high-traffic applications</strong>.",
  ];
</script>

<ResumeSection
  title="Key Qualifications"
  iconName="star-icon"
  iconWidth="21"
  iconHeight="20"
>
  <BulletList>
    {#each qualifications as qualification}
      <BulletItem>
        {@html qualification}
      </BulletItem>
    {/each}
  </BulletList>
</ResumeSection>
