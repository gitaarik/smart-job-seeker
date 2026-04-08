<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/stores";
  import {
    faBriefcase,
    faCode,
    faGlobe,
    faGraduationCap,
    faLightbulb,
    faUser,
    faUserFriends,
    faWrench,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../components/SectionHeader.svelte";
  import TabNav from "../../components/TabNav.svelte";

  let { children }: { children: Snippet } = $props();

  const tabs = [
    { label: "Basic Info", href: "/dashboard/profile/edit", icon: faUser },
    { label: "Work Experience", href: "/dashboard/profile/work-experience", icon: faBriefcase },
    { label: "Education", href: "/dashboard/profile/education", icon: faGraduationCap },
    { label: "Skills", href: "/dashboard/profile/skills", icon: faWrench },
    { label: "Side Projects", href: "/dashboard/profile/side-projects", icon: faCode },
    { label: "Languages", href: "/dashboard/profile/languages", icon: faGlobe },
    { label: "References", href: "/dashboard/profile/references", icon: faUserFriends },
    { label: "Highlights", href: "/dashboard/profile/highlights", icon: faLightbulb },
  ];

  function isTabActive(href: string): boolean {
    return $page.url.pathname.startsWith(href);
  }
</script>

<div class="space-y-6">
  <SectionHeader title="Profile Data" icon={faUser} />

  <TabNav {tabs} isActive={isTabActive}>
    {@render children()}
  </TabNav>
</div>
