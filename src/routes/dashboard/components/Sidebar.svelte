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
    faDatabase,
    faDownload,
    faFileAlt,
    faFileImport,
    faGlobe,
    faGraduationCap,
    faHome,
    faLink,
    faListCheck,
    faMoneyBillWave,
    faPaperPlane,
    faRobot,
    faSearch,
    faStickyNote,
    faTimes,
    faTrash,
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
          label: "Letters & Forms",
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
      ],
    },
    {
      label: "Data & Settings",
      href: "/dashboard/export",
      icon: faCog,
      children: [
        {
          label: "Resume/CV Versions",
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
          label: "Delete Profile",
          href: "/dashboard/export/delete",
          icon: faTrash,
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

  // Auto-expand sections that contain the active menu item
  $effect(() => {
    const currentPath = $page.url.pathname;
    const sectionsToExpand = new Set<string>();

    for (const item of menuItems) {
      if (item.children) {
        const hasActiveChild = item.children.some(
          (child) =>
            currentPath === child.href || currentPath.startsWith(child.href + "/"),
        );
        if (hasActiveChild) {
          sectionsToExpand.add(item.label);
        }
      }
    }

    // Only update if there are sections to expand that aren't already expanded
    for (const section of sectionsToExpand) {
      if (!expandedSections.has(section)) {
        expandedSections = new Set([...expandedSections, ...sectionsToExpand]);
        break;
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
    fixed left-0 w-56 bg-[var(--dash-card)] border-r border-[var(--dash-border)] z-40 transform transition-transform duration-200 ease-in-out
    top-[65px] h-[calc(100vh-65px)]
    lg:translate-x-0 {mobileMenuOpen
    ? 'translate-x-0'
    : '-translate-x-full'}
  "
>
  <nav class="p-3 overflow-y-auto h-full">
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
  </nav>
</aside>
