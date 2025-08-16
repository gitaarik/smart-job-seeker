<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";

  const profileData = [
    { icon: "location-icon", text: "Ronda, Spain" },
    { icon: "languages-icon", text: "English: Fluent    Dutch: Native" },
    { icon: "phone-icon", text: "+31 649118511", href: "tel:+31649118511" },
    {
      icon: "email-icon",
      text: "rik@rikwanders.tech",
      href: "mailto:rik@rikwanders.tech",
    },
    {
      icon: "website-icon",
      text: "www.rikwanders.tech",
      href: "https://www.rikwanders.tech",
      target: "_blank",
    },
    {
      icon: "linkedin-icon",
      text: "linkedin.com/in/rik-wanders-software/",
      href: "https://www.linkedin.com/in/rik-wanders-software/",
      target: "_blank",
    },
  ];
</script>

<ResumeSection
  title="Profile"
  iconName="person-icon"
  iconWidth="21"
  iconHeight="20"
>
  <ul class="columns-2 gap-6">
    {#each profileData as item (item.icon)}
      <li class="flex items-start mb-3 break-inside-avoid">
        <div class="mr-2 flex-shrink-0">
          <svg width="18" height="18"><use href="#{item.icon}" /></svg>
        </div>
        <p>
          {#if item.href}
            <a
              href={item.href}
              class="text-cyan-900 hover:text-cyan-600"
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
