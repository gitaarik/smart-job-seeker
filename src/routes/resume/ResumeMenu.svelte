<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faUser,
    faGraduationCap,
    faBriefcase,
    faWrench,
    faHeart,
    faHandshake,
    faRobot,
    faUsers,
  } from "@fortawesome/free-solid-svg-icons";

  export let activeSection = "overview";

  const sections = [
    {
      id: "overview",
      label: "Overview",
      icon: faUser,
    },
    {
      id: "personality",
      label: "Personality & Methods",
      icon: faRobot,
    },
    {
      id: "technical",
      label: "Technical Expertise",
      icon: faWrench,
    },
    {
      id: "experience",
      label: "Professional Experience",
      icon: faBriefcase,
    },
    {
      id: "education",
      label: "Education",
      icon: faGraduationCap,
    },
    {
      id: "interests",
      label: "Hobbies / Interests",
      icon: faHeart,
    },
    {
      id: "references",
      label: "References",
      icon: faUsers,
    },
  ];

  function handleSectionClick(sectionId: string) {
    activeSection = sectionId;
    // Dispatch custom event to parent
    const event = new CustomEvent("sectionChange", {
      detail: { section: sectionId }
    });
    document.dispatchEvent(event);
  }
</script>

<nav class="bg-frost print:bg-transparent border-[1.2px] border-ocean rounded-xl print:border-0 mb-6">
  <div class="flex flex-wrap gap-1 p-2">
    {#each sections as section}
      <button
        class="flex items-center px-3 py-2 rounded-lg text-sm transition-colors duration-200 {activeSection === section.id
          ? 'bg-ocean text-white'
          : 'text-slate hover:bg-ocean/10 hover:text-teal'}"
        on:click={() => handleSectionClick(section.id)}
      >
        <FontAwesomeIcon icon={section.icon} class="w-3 h-3 mr-2" />
        <span class="whitespace-nowrap">{section.label}</span>
      </button>
    {/each}
  </div>
</nav>