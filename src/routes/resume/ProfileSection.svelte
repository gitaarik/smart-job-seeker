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
  import resume from "$lib/data/resume.json";

  const languageText = resume.languages.map(lang => `${lang.language}: ${lang.fluency}`).join(", ");

  const linkedInProfile = resume.basics.profiles.find(p => p.network === 'LinkedIn');

  const profileData = [
    { icon: faMapMarkerAlt, text: resume.basics.location.address },
    { icon: faLanguage, text: languageText },
    { icon: faPhone, text: resume.basics.phone, href: `tel:${resume.basics.phone}` },
    {
      icon: faEnvelope,
      text: resume.basics.email,
      href: `mailto:${resume.basics.email}`,
    },
    {
      icon: faGlobe,
      text: resume.basics.url.replace('https://', ''),
      href: resume.basics.url,
      target: "_blank",
    },
    {
      icon: faLinkedin,
      text: linkedInProfile?.url.replace('https://www.', '') || '',
      href: linkedInProfile?.url || '',
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
              class="underline text-slate hover:text-teal"
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
