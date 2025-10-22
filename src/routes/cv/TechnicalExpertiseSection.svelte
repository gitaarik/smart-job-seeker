<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import InfoBoxes from "./InfoBoxes.svelte";
  import { faCode } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";

  let props = $props();
  const profile = props.profile;

  function getSkills() {

    const skills: string[object] = {};

    for (const skill of profile.tech_skills) {

      if (!(skill.category in skills)) {
        skills[skill.category] = []
      }

      skills[skill.category].push(skill.name)

    }

    console.log(skills)

    return resume.skills.map((skill) => ({
      title: skill.name,
      description: skill.keywords.join(", "),
      icon: skill.icon,
    }));
  }
</script>

<InfoSection title="Technical Expertise" icon={faCode}>
  <InfoBoxes items={getSkills()} />
</InfoSection>
