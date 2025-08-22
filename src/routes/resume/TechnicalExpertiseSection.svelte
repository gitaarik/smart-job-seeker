<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import InfoBoxes from "./InfoBoxes.svelte";
  import { faCode } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";

  function getSkills() {
    return resume.skills.map((skill) => ({
      title: skill.name,
      description: skill.keywords.join(", "),
      icon: skill.icon,
    }));
  }
</script>

<ResumeSection title="Technical Expertise" icon={faCode}>
  <InfoBoxes items={getSkills()} />
</ResumeSection>
