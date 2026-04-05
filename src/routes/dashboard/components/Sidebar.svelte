<script lang="ts">
  import { page } from "$app/stores";
  import { sidebarState } from "./sidebar-state.svelte";
  import { feedbackState } from "./feedback-state.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBars,
    faBookmark,
    faBriefcase,
    faBullseye,
    faChartBar,
    faChevronDown,
    faChevronRight,
    faCode,
    faCog,
    faCommentDots,
    faComments,
    faDatabase,
    faDesktop,
    faDownload,
    faEnvelope,
    faFileAlt,
    faFileImport,
    faGlobe,
    faGraduationCap,
    faHome,
    faLink,
    faListCheck,
    faMoneyBillWave,
    faPalette,
    faPaperPlane,
    faRobot,
    faSearch,
    faShieldAlt,
    faSliders,
    faStickyNote,
    faTimes,
    faTrash,
    faUser,
    faUserFriends,
    faUsers,
    faUserTie,
    faWrench,
  } from "@fortawesome/free-solid-svg-icons";
  import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

  interface MenuItem {
    label: string;
    href: string;
    icon: IconDefinition;
    children?: MenuItem[];
  }

  const baseMenuItems: MenuItem[] = [
    {
      label: "Overview",
      href: "/dashboard",
      icon: faHome,
    },
    {
      label: "Job Search",
      href: "/dashboard/jobs",
      icon: faSearch,
      children: [
        {
          label: "Search Tasks",
          href: "/dashboard/jobs/search-tasks",
          icon: faSearch,
        },
        {
          label: "Job Matching",
          href: "/dashboard/jobs/matching",
          icon: faBullseye,
        },
        {
          label: "Job Matches",
          href: "/dashboard/jobs?minScore=50",
          icon: faListCheck,
        },
        {
          label: "Saved Jobs",
          href: "/dashboard/jobs?status=saved",
          icon: faBookmark,
        },
        {
          label: "All Jobs",
          href: "/dashboard/jobs",
          icon: faBriefcase,
        },
      ],
    },
    {
      label: "Applications",
      href: "/dashboard/applications",
      icon: faPaperPlane,
      children: [
        {
          label: "All Applications",
          href: "/dashboard/applications/active",
          icon: faPaperPlane,
        },
        {
          label: "Salary Expectations",
          href: "/dashboard/applications/salary",
          icon: faMoneyBillWave,
        },
      ],
    },
    {
      label: "Interview Prep",
      href: "/dashboard/interview",
      icon: faUserTie,
      children: [
        {
          label: "Project Stories",
          href: "/dashboard/interview/stories",
          icon: faComments,
        },
        {
          label: "Cheat Sheets",
          href: "/dashboard/interview/cheatsheets",
          icon: faStickyNote,
        },
      ],
    },
    {
      label: "Profile",
      href: "/dashboard/profile",
      icon: faUser,
      children: [
        {
          label: "Basic Info",
          href: "/dashboard/profile/edit",
          icon: faUser,
        },
        {
          label: "Work Experience",
          href: "/dashboard/profile/work-experience",
          icon: faBriefcase,
        },
        {
          label: "Education",
          href: "/dashboard/profile/education",
          icon: faGraduationCap,
        },
        {
          label: "Skills",
          href: "/dashboard/profile/skills",
          icon: faWrench,
        },
        {
          label: "Side Projects",
          href: "/dashboard/profile/side-projects",
          icon: faCode,
        },
        {
          label: "Languages",
          href: "/dashboard/profile/languages",
          icon: faGlobe,
        },
        {
          label: "References",
          href: "/dashboard/profile/references",
          icon: faUserFriends,
        },
      ],
    },
    {
      label: "Data & Settings",
      href: "/dashboard/export",
      icon: faCog,
      children: [
        {
          label: "Resumes & CVs",
          href: "/dashboard/export/resume",
          icon: faFileAlt,
        },
        {
          label: "Private Links",
          href: "/dashboard/export/share",
          icon: faLink,
        },
        {
          label: "Export Data",
          href: "/dashboard/export/data",
          icon: faDownload,
        },
        {
          label: "Import Data",
          href: "/dashboard/export/import",
          icon: faFileImport,
        },
        {
          label: "Local Scraping",
          href: "/dashboard/export/local-setup",
          icon: faDesktop,
        },
        {
          label: "Delete Profile",
          href: "/dashboard/export/delete",
          icon: faTrash,
        },
      ],
    },
  ];

  const adminMenuItems: MenuItem[] = [
    {
      label: "Admin",
      href: "/dashboard/admin",
      icon: faShieldAlt,
      children: [
        {
          label: "Users",
          href: "/dashboard/admin/users",
          icon: faUsers,
        },
        {
          label: "Scraper",
          href: "/dashboard/admin/scraper",
          icon: faSearch,
        },
        {
          label: "Matcher",
          href: "/dashboard/admin/matcher",
          icon: faChartBar,
        },
        {
          label: "Scraper Agent",
          href: "/dashboard/admin/scraper-agent",
          icon: faRobot,
        },
        {
          label: "AI Chats",
          href: "/dashboard/admin/ai-chats",
          icon: faComments,
        },
        {
          label: "Feedback",
          href: "/dashboard/admin/feedback",
          icon: faCommentDots,
        },
        {
          label: "Style Guide",
          href: "/dashboard/admin/style-guide",
          icon: faPalette,
        },
      ],
    },
  ];

  let menuItems = $derived(
    ($page.data.user as { is_admin?: boolean })?.is_admin
      ? [...baseMenuItems, ...adminMenuItems]
      : baseMenuItems,
  );

  let mobileMenuOpen = $derived(sidebarState.mobileOpen);
  let expandedSections = $state<Set<string>>(new Set());
  let lastPath = $state("");

  // Check if a child menu item should be considered active
  function isChildHrefActive(
    href: string,
    currentPath: string,
    currentSearch: string,
  ): boolean {
    const [hrefPath, hrefSearch] = href.split("?");
    const currentParams = new URLSearchParams(currentSearch);

    // Application detail pages (/dashboard/applications/123/...) → highlight "All Applications"
    if (currentPath.match(/^\/dashboard\/applications\/\d+/) && href === "/dashboard/applications/active") {
      return true;
    }

    // Job detail pages (/dashboard/jobs/123) - check jobCategory from page data
    const jobDetailMatch = currentPath.match(/^\/dashboard\/jobs\/(\d+)$/);
    if (jobDetailMatch) {
      const jobCategory = $page.data?.jobCategory;
      if (href === "/dashboard/jobs?status=saved" && jobCategory === "saved") {
        return true;
      }
      if (href === "/dashboard/jobs?minScore=50" && jobCategory === "matches") {
        return true;
      }
      if (href === "/dashboard/jobs" && (jobCategory === "all" || !jobCategory)) {
        return true;
      }
      return false;
    }

    // Jobs list page - determine which sidebar item is active based on current params
    if (currentPath === "/dashboard/jobs" && hrefPath === "/dashboard/jobs") {
      const hasStatus = currentParams.has("status");
      const hasMinScore = currentParams.has("minScore");

      if (href === "/dashboard/jobs?status=saved") {
        return hasStatus && currentParams.get("status")!.includes("saved");
      }
      if (href === "/dashboard/jobs?minScore=50") {
        return hasMinScore && !hasStatus;
      }
      if (href === "/dashboard/jobs") {
        return !hasMinScore && !hasStatus;
      }
      return false;
    }

    if (hrefSearch) {
      // For other hrefs with query params, match path + all params
      if (currentPath === hrefPath) {
        const hrefParams = new URLSearchParams(hrefSearch);
        for (const [key, value] of hrefParams) {
          if (currentParams.get(key) !== value) return false;
        }
        return true;
      }
      return false;
    }

    // For plain paths - exact match
    if (currentPath === href) {
      return true;
    }

    // Subpath matching - but NOT for /dashboard/jobs (All Jobs)
    if (href !== "/dashboard/jobs" && currentPath.startsWith(href + "/")) {
      return true;
    }

    return false;
  }

  // Auto-expand sections that contain the active menu item, but only on navigation
  $effect(() => {
    const currentHref = $page.url.pathname + $page.url.search;
    if (currentHref === lastPath) return;
    lastPath = currentHref;

    const currentPath = $page.url.pathname;
    const currentSearch = $page.url.search;

    for (const item of menuItems) {
      if (item.children) {
        const hasActiveChild = item.children.some((child) =>
          isChildHrefActive(child.href, currentPath, currentSearch)
        );
        if (hasActiveChild && !expandedSections.has(item.label)) {
          expandedSections = new Set([...expandedSections, item.label]);
        }
      }
    }
  });

  function toggleSection(label: string) {
    const newSet = new Set(expandedSections);
    if (newSet.has(label)) {
      newSet.delete(label);
    } else {
      newSet.add(label);
    }
    expandedSections = newSet;
  }

  function isActive(href: string): boolean {
    const currentPath = $page.url.pathname;
    const currentSearch = $page.url.search;
    if (href === "/dashboard") {
      return currentPath === "/dashboard";
    }
    return isChildHrefActive(href, currentPath, currentSearch);
  }

  function isChildActive(item: MenuItem): boolean {
    if (!item.children) return false;
    return item.children.some((child) => isActive(child.href));
  }

  function closeMobileMenu() {
    sidebarState.mobileOpen = false;
  }
</script>

<!-- Mobile menu button -->
<button
  type="button"
  onclick={() => (sidebarState.mobileOpen = !sidebarState.mobileOpen)}
  class="lg:hidden fixed bottom-4 right-4 z-50 w-14 h-14 bg-[var(--dash-primary)] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-[var(--dash-primary-hover)] transition-colors"
  aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
>
  <FontAwesomeIcon icon={mobileMenuOpen ? faTimes : faBars} class="w-6 h-6" />
</button>

<!-- Mobile overlay -->
{#if mobileMenuOpen}
  <button
    type="button"
    class="lg:hidden fixed inset-0 bg-black/50 z-40"
    onclick={closeMobileMenu}
    aria-label="Close menu"
  >
  </button>
{/if}

<!-- Sidebar -->
<aside
  class="
    fixed left-0 w-56 bg-[var(--dash-card)] border-r border-[var(--dash-border)] z-40 transform transition-transform duration-200 ease-in-out
    top-[65px] h-[calc(100vh-65px)]
    lg:translate-x-0 {mobileMenuOpen
    ? 'translate-x-0'
    : '-translate-x-full'}
  "
>
  <nav class="p-3 pb-16 overflow-y-auto h-full">
    <ul class="space-y-1">
      {#each menuItems as item}
          {#if item.children}
            <!-- Section with children -->
            <li>
              <button
                type="button"
                onclick={() => toggleSection(item.label)}
                class="
                  w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm text-left transition-colors {isChildActive(
                  item,
                  )
                  ? 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
                  : 'text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'}
                "
              >
                <div class="flex items-center gap-2">
                  <FontAwesomeIcon icon={item.icon} class="w-4 h-4" />
                  <span class="font-medium">{item.label}</span>
                </div>
                {#if expandedSections.has(item.label)}
                  <FontAwesomeIcon icon={faChevronDown} class="w-3 h-3" />
                {:else}
                  <FontAwesomeIcon icon={faChevronRight} class="w-3 h-3" />
                {/if}
              </button>

              {#if expandedSections.has(item.label)}
                <ul
                  class="mt-1 ml-4 pl-4 border-l border-[var(--dash-border)] space-y-1"
                >
                  {#each item.children as child}
                    <li>
                      <a
                        href={child.href}
                        onclick={closeMobileMenu}
                        class="
                          flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors {isActive(
                          child.href,
                          )
                          ? 'bg-[var(--dash-primary)] text-white'
                          : 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)]'}
                        "
                      >
                        <FontAwesomeIcon icon={child.icon} class="w-4 h-4" />
                        <span class="text-sm">{child.label}</span>
                      </a>
                    </li>
                  {/each}
                </ul>
              {/if}
            </li>
          {:else}
            <!-- Single item -->
            <li>
              <a
                href={item.href}
                onclick={closeMobileMenu}
                class="
                  flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors {isActive(
                  item.href,
                  )
                  ? 'bg-[var(--dash-primary)] text-white'
                  : 'text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'}
                "
              >
                <FontAwesomeIcon icon={item.icon} class="w-4 h-4" />
                <span class="font-medium">{item.label}</span>
              </a>
            </li>
          {/if}
        {/each}
      </ul>

    <!-- Feedback button -->
    <div class="mt-4 pt-3 border-t border-[var(--dash-border)]">
      <button
        type="button"
        onclick={() => { feedbackState.open = true; feedbackState.minimized = false; closeMobileMenu(); }}
        class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-[var(--dash-primary)] hover:bg-[var(--dash-primary)]/10"
      >
        <FontAwesomeIcon icon={faCommentDots} class="w-4 h-4" />
        <span>Send Feedback</span>
      </button>
    </div>
  </nav>
</aside>
