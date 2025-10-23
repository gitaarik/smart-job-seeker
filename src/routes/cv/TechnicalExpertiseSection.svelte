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

      const category = profile.tech_skill_categories.find(
        (c: object) => c.id === skill.category
      )

      if (!category) {
        continue;
      }

      if (!(category.name in skills)) {
        skills[category.name] = []
      }

      skills[category.name].push(skill.name)

    }

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
