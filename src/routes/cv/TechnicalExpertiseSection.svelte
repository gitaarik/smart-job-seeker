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

    const skillsByCategory: Record<string, string[]> = {};

    for (const skill of profile.tech_skills) {

      if (!(skill.category in skillsByCategory)) {
        skillsByCategory[skill.category] = []
      }

      skillsByCategory[skill.category].push(skill.name)

    }

    const skillsList = [];

    for (const category of profile.tech_skill_categories) {

      const skills = skillsByCategory[category.id];

      skillsList.push({
        title: category.name,
        description: skills ? skills.join(", ") : '',
        icon: category.fa_icon,
      })

    }

    return skillsList;

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
