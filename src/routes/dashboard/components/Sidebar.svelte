<script lang="ts">
  import { page } from "$app/stores";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBars,
    faBookmark,
    faBriefcase,
    faChevronDown,
    faChevronRight,
    faCode,
    faCog,
    faComments,
    faEnvelope,
    faFileAlt,
    faFileExport,
    faGlobe,
    faGraduationCap,
    faHome,
    faLightbulb,
    faLink,
    faListCheck,
    faMoneyBillWave,
    faPaperPlane,
    faRobot,
    faSearch,
    faStickyNote,
    faTimes,
    faUser,
    faUserFriends,
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

  const menuItems: MenuItem[] = [
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
          label: "Search Settings",
          href: "/dashboard/jobs/settings",
          icon: faCog,
        },
        {
          label: "Job Matches",
          href: "/dashboard/jobs/matches",
          icon: faListCheck,
        },
        {
          label: "Saved Jobs",
          href: "/dashboard/jobs/saved",
          icon: faBookmark,
        },
      ],
    },
    {
      label: "Applications",
      href: "/dashboard/applications",
      icon: faPaperPlane,
      children: [
        {
          label: "Active Applications",
          href: "/dashboard/applications/active",
          icon: faPaperPlane,
        },
        {
          label: "Application Letters",
          href: "/dashboard/applications/letters",
          icon: faEnvelope,
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
        {
          label: "Highlights",
          href: "/dashboard/profile/highlights",
          icon: faLightbulb,
        },
      ],
    },
    {
      label: "Export & Share",
      href: "/dashboard/export",
      icon: faFileExport,
      children: [
        {
          label: "Resume/CV Versions",
          href: "/dashboard/export/resume",
          icon: faFileAlt,
        },
        {
          label: "Share Links",
          href: "/dashboard/export/share",
          icon: faLink,
        },
      ],
    },
    {
      label: "AI Assistant",
      href: "/dashboard/ai",
      icon: faRobot,
    },
  ];

  let mobileMenuOpen = $state(false);
  let expandedSections = $state<Set<string>>(new Set());

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
    if (href === "/dashboard") {
      return currentPath === "/dashboard";
    }
    return currentPath === href || currentPath.startsWith(href + "/");
  }

  function isChildActive(item: MenuItem): boolean {
    if (!item.children) return false;
    return item.children.some((child) => isActive(child.href));
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }
</script>

<!-- Mobile menu button -->
<button
  type="button"
  onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
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
    fixed top-0 left-0 h-full w-64 bg-[var(--dash-card)] border-r border-[var(--dash-border)] z-40 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:top-[61px] lg:h-[calc(100vh-61px)] {mobileMenuOpen
    ? 'translate-x-0'
    : '-translate-x-full'}
  "
>
  <nav class="p-4 overflow-y-auto h-full">
    <ul class="space-y-1">
      {#each menuItems as item}
        {#if item.children}
          <!-- Section with children -->
          <li>
            <button
              type="button"
              onclick={() => toggleSection(item.label)}
              class="
                w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors {isChildActive(
                item,
                )
                ? 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
                : 'text-[var(--dash-text)] hover:bg-gray-100'}
              "
            >
              <div class="flex items-center gap-3">
                <FontAwesomeIcon icon={item.icon} class="w-4 h-4" />
                <span class="font-medium">{item.label}</span>
              </div>
              <FontAwesomeIcon
                icon={expandedSections.has(item.label)
                  ? faChevronDown
                  : faChevronRight}
                class="w-3 h-3"
              />
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
                        flex items-center gap-3 px-3 py-2 rounded-lg transition-colors {isActive(
                        child.href,
                        )
                        ? 'bg-[var(--dash-primary)] text-white'
                        : 'text-[var(--dash-text-secondary)] hover:bg-gray-100 hover:text-[var(--dash-text)]'}
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
                flex items-center gap-3 px-3 py-2 rounded-lg transition-colors {isActive(
                item.href,
                )
                ? 'bg-[var(--dash-primary)] text-white'
                : 'text-[var(--dash-text)] hover:bg-gray-100'}
              "
            >
              <FontAwesomeIcon icon={item.icon} class="w-4 h-4" />
              <span class="font-medium">{item.label}</span>
            </a>
          </li>
        {/if}
      {/each}
    </ul>
  </nav>
</aside>
