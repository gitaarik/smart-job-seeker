<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import InfoBoxes from "./InfoBoxes.svelte";
  import { faCode } from "@fortawesome/free-solid-svg-icons";

  interface Skill {
    name: string;
  }

  let props = $props();
  const profile = props.profile;

  function getSkills() {
    const skillsByCategory = [];

    for (const category of profile.tech_skill_categories) {
      const skills = category.tech_skills.map((s: Skill) => s.name);

      skillsByCategory.push({
        title: category.name,
        description: skills.join(", "),
        fa_icon: category.fa_icon,
      });
    }

    return skillsByCategory;
  }
</script>

<InfoSection title="Technical Expertise" icon={faCode}>
  <InfoBoxes items={getSkills()} />
</InfoSection>
