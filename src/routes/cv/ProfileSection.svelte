<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faEnvelope,
    faFlag,
    faGlobe,
    faLanguage,
    faMapMarkerAlt,
    faPhone,
    faUser,
  } from "@fortawesome/free-solid-svg-icons";
  import { faLinkedin } from "@fortawesome/free-brands-svg-icons";

  let props = $props();
  const profile = props.profile;

  const languageText = profile.languages.map((lang) =>
    `${lang.name}: ${lang.proficiency[0].toUpperCase() + lang.proficiency.slice(1)}`
  ).join(", ");

  const linkedInProfile = profile.linkedin_profile;

  const profileData = [
    {
      icon: faMapMarkerAlt,
      text: profile.location,
      label: "Location"
    },

    {
      icon: faLanguage,
      text: languageText,
      label: "Language"
    },

    {
      icon: faFlag,
      text: profile.nationality,
      label: "Nationality"
    },

    {
      icon: faPhone,
      text: profile.phone_number,
      href: `tel:${profile.phone_number}`,
      label: "Phone number"
    },

    {
      icon: faEnvelope,
      text: profile.email_address,
      href: `mailto:${profile.email_address}`,
      label: "Email address"
    },

    {
      icon: faGlobe,
      text: profile.personal_website.replace("https://", ""),
      href: profile.personal_website,
      target: "_blank",
      label: "Website"
    },

    {
      icon: faLinkedin,
      text: linkedInProfile?.replace("https://www.", "") || "",
      href: linkedInProfile || "",
      target: "_blank",
      label: "LinkedIn"
    },
  ];
</script>

<InfoSection title="Profile" icon={faUser}>
  <ul class="columns-2 gap-6">
    {#each profileData as item (item.label)}
      <li class="flex items-start mb-4 break-inside-avoid" aria-label={item.label}>
        <div class="mr-2 flex-shrink-0">
          <FontAwesomeIcon icon={item.icon} class="w-4 h-4 mt-1" title={item.label} />
        </div>
        <p>
          {#if item.href}
            <a
              href={item.href}
              class="underline text-slate hover:text-teal"
              target={item.target || ""}
              title={item.label}
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
</InfoSection>
