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
    { label: "Basic Info", href: "/dashboard/profile/edit", icon: faUser },
    { label: "Skills", href: "/dashboard/profile/skills", icon: faWrench },
    { label: "Experience", href: "/dashboard/profile/work-experience", icon: faBriefcase },
    { label: "Side Projects", href: "/dashboard/profile/side-projects", icon: faCode },
    { label: "Education", href: "/dashboard/profile/education", icon: faGraduationCap },
    { label: "Certificates", href: "/dashboard/profile/certificates", icon: faCertificate },
    { label: "Languages", href: "/dashboard/profile/languages", icon: faGlobe },
    { label: "References", href: "/dashboard/profile/references", icon: faUserFriends },
  ];

  function isTabActive(href: string): boolean {
    return $page.url.pathname.startsWith(href);
  }
</script>

<TabNav {tabs} isActive={isTabActive} inset>
  {@render children()}
</TabNav>
