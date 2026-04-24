<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/stores";
  import {
    faBriefcase,
    faCertificate,
    faCode,
    faGlobe,
    faGraduationCap,
    faUser,
    faUserFriends,
    faWrench,
  } from "@fortawesome/free-solid-svg-icons";
  import TabNav from "../../components/TabNav.svelte";

  let { children }: { children: Snippet } = $props();

  const tabs = [
    { label: "Basic Info", href: "/profile/edit", icon: faUser },
    { label: "Skills", href: "/profile/skills", icon: faWrench },
    { label: "Experience", href: "/profile/work-experience", icon: faBriefcase },
    { label: "Side Projects", href: "/profile/side-projects", icon: faCode },
    { label: "Education", href: "/profile/education", icon: faGraduationCap },
    { label: "Certificates", href: "/profile/certificates", icon: faCertificate },
    { label: "Languages", href: "/profile/languages", icon: faGlobe },
    { label: "References", href: "/profile/references", icon: faUserFriends },
  ];

  function isTabActive(href: string): boolean {
    return $page.url.pathname.startsWith(href);
  }
</script>

<TabNav {tabs} isActive={isTabActive} inset>
  {@render children()}
</TabNav>
