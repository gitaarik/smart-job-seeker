<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faEnvelope,
    faGlobe,
    faLanguage,
    faMapMarkerAlt,
    faPhone,
    faUser,
  } from "@fortawesome/free-solid-svg-icons";
  import { faLinkedin } from "@fortawesome/free-brands-svg-icons";

  const profileData = [
    { icon: faMapMarkerAlt, text: "Ronda, Spain" },
    { icon: faLanguage, text: "English: Fluent    Dutch: Native" },
    { icon: faPhone, text: "+31 649118511", href: "tel:+31649118511" },
    {
      icon: faEnvelope,
      text: "rik@rikwanders.tech",
      href: "mailto:rik@rikwanders.tech",
    },
    {
      icon: faGlobe,
      text: "www.rikwanders.tech",
      href: "https://www.rikwanders.tech",
      target: "_blank",
    },
    {
      icon: faLinkedin,
      text: "linkedin.com/in/rik-wanders-software/",
      href: "https://www.linkedin.com/in/rik-wanders-software/",
      target: "_blank",
    },
  ];
</script>

<ResumeSection title="Profile" icon={faUser}>
  <ul class="columns-2 gap-6">
    {#each profileData as item (item.icon)}
      <li class="flex items-start mb-4 break-inside-avoid">
        <div class="mr-2 flex-shrink-0">
          <FontAwesomeIcon icon={item.icon} class="w-4 h-4 mt-1" />
        </div>
        <p>
          {#if item.href}
            <a
              href={item.href}
              class="underline text-cyan-900 hover:text-cyan-600"
              target={item.target || ""}
            >
              {item.text}
            </a>
          {:else}
            {item.text}
          {/if}
        </p>
      </li>
    {/each}
  </ul>
</ResumeSection>
