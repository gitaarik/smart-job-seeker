<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { 
    faStar, 
    faCalendarAlt, 
    faCode, 
    faServer, 
    faUsers, 
    faRobot, 
    faHome, 
    faRocket 
  } from "@fortawesome/free-solid-svg-icons";

  const qualifications = [
    {
      text: "<strong>18+ years</strong> of <strong>full stack development experience</strong>.",
      icon: faCalendarAlt
    },
    {
      text: "Expertise in modern <strong>Python, JavaScript & Node.js</strong> ecosystems.",
      icon: faCode
    },
    {
      text: "Additional experience in <strong>Linux, DevOps & CI/CD.</strong>",
      icon: faServer
    },
    {
      text: "<strong>Team leadership</strong> and <strong>project management</strong> experience.",
      icon: faUsers
    },
    {
      text: "Skilled in <strong>AI-accelerated development</strong>, with business security in mind.",
      icon: faRobot
    },
    {
      text: "<strong>5+ years remote work</strong> and distributed team collaboration experience.",
      icon: faHome
    },
    {
      text: "Proven track record scaling <strong>high-traffic applications</strong>.",
      icon: faRocket
    },
  ];
</script>

<ResumeSection title="Key Qualifications" icon={faStar}>
  <ul class="space-y-4 ml-1">
    {#each qualifications as qualification (qualification.text)}
      <li class="flex items-start">
        <FontAwesomeIcon 
          icon={qualification.icon} 
          class="mr-3 mt-1 w-4 h-4" 
        />
        <span>{@html qualification.text}</span>
      </li>
    {/each}
  </ul>
</ResumeSection>
