<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import InfoBoxes from "./InfoBoxes.svelte";
  import { faCode } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";

  interface TechSkillCategory {
    id: string | number;
    name: string;
  }

  let props = $props();
  const profile = props.profile;

  function getSkills() {
    const skillsByCategory = [];

    for (const category of profile.tech_skill_categories) {
      const skills = category.tech_skills.map((s) => s.name);

      skillsByCategory.push({
        title: category.name,
        description: skills.join(", "),
        icon: category.fa_icon,
      });
    }

    return skillsByCategory;

    // return resume.skills.map((skill) => ({
    //   title: skill.name,
    //   description: skill.keywords.join(", "),
    //   icon: skill.icon,
    // }));
  }
</script>

<InfoSection title="Technical Expertise" icon={faCode}>
  <InfoBoxes items={getSkills()} />
</InfoSection>
