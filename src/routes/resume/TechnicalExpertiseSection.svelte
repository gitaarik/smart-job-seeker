<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import InfoBoxes from "./InfoBoxes.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCode,
    faCrown,
    faHardHat,
  } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";

  // Function to transform skills by level to InfoBoxes format
  function getSkillsByLevel(level: string) {
    return resume.skills
      .filter((skill) => skill.level === level)
      .map((skill) => ({
        title: skill.name,
        description: skill.keywords.join(", "),
        icon: skill.icon,
      }));
  }

  const expertKnowledge = getSkillsByLevel("Expert");
  const workingKnowledge = getSkillsByLevel("Proficient");
</script>

<ResumeSection title="Technical Expertise" icon={faCode}>
  <div class="space-y-8 print:space-y-4">
    <div>
      <h3
        class="flex items-center pt-4 pb-2 mb-5 border-b border-ocean"
      >
        <span class="text-lg font-medium">Expert Knowledge</span>
        <FontAwesomeIcon icon={faCrown} class="w-4 h-4 ml-2" />
      </h3>
      <InfoBoxes items={expertKnowledge} />
    </div>

    <div>
      <h3
        class="flex items-center pt-4 pb-2 mb-5 border-b border-ocean"
      >
        <span class="text-lg font-medium">Working Knowledge</span>
        <FontAwesomeIcon icon={faHardHat} class="w-4 h-4 ml-2" />
      </h3>
      <InfoBoxes items={workingKnowledge} />
    </div>
  </div>
</ResumeSection>
