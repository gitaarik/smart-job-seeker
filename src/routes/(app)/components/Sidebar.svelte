<script lang="ts">
  import { page } from "$app/stores";
  import { sidebarState, overlayState } from "./sidebar-state.svelte";
  import { feedbackState } from "./feedback-state.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBars,
    faBookmark,
    faBriefcase,
    faChartBar,
    faChartLine,
    faChevronDown,
    faBinoculars,
    faBuilding,
    faChevronRight,
    faCog,
    faCompass,
    faCrosshairs,
    faCommentDots,
    faComments,
    faDatabase,
    faEnvelope,
    faExchangeAlt,
    faFileAlt,
    faWrench,
    faHome,
    faLink,
    faListCheck,
    faMoneyBillWave,
    faPalette,
    faPaperPlane,
    faRobot,
    faSearch,
    faShieldAlt,
    faTimes,
    faTrash,
    faUser,
    faUsers,
    faUserTie,
  } from "@fortawesome/free-solid-svg-icons";
  import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

  const planIcons: Record<string, { icon: IconDefinition; color: string; activeColor: string }> = {
    explorer: { icon: faCompass, color: "text-green-500", activeColor: "text-green-200" },
    seeker: { icon: faBinoculars, color: "text-blue-500", activeColor: "text-blue-200" },
    hunter: { icon: faCrosshairs, color: "text-amber-500", activeColor: "text-amber-200" },
    contractor: { icon: faBuilding, color: "text-purple-500", activeColor: "text-purple-200" },
  };

  import type { CreditBalance } from "$lib/server/billing/credits";

  let { creditBalance }: { creditBalance?: CreditBalance } = $props();

  let planIcon = $derived(planIcons[creditBalance?.plan ?? 'explorer'] ?? planIcons.explorer);
  let planLabel = $derived((creditBalance?.plan ?? 'Free').replace(/^./, (c) => c.toUpperCase()));

  interface MenuItem {
    label: string;
    href: string;
    icon: IconDefinition;
    children?: MenuItem[];
    alsoActiveFor?: string[];
  }

  const baseMenuItems: MenuItem[] = [
    {
      label: "Overview",
      href: "/home",
      icon: faHome,
    },
    {
      label: "Job Search",
      href: "/jobs",
      icon: faSearch,
      children: [
        {
          label: "Job Import",
          href: "/jobs/import",
          icon: faRobot,
        },
        {
          label: "Job Matches",
          href: "/jobs?minScore=50",
          icon: faListCheck,
        },
        {
          label: "Saved Jobs",
          href: "/jobs?status=saved",
          icon: faBookmark,
        },
        {
          label: "All Jobs",
          href: "/jobs",
          icon: faBriefcase,
        },
      ],
    },
    {
      label: "Applying",
      href: "/applications",
      icon: faPaperPlane,
      children: [
        {
          label: "Applications",
          href: "/applications/active",
          icon: faPaperPlane,
        },
        {
          label: "Salary Prep",
          href: "/applications/salary",
          icon: faMoneyBillWave,
        },
        {
          label: "Interview Prep",
          href: "/applications/interview",
          icon: faComments,
        },
      ],
    },
    {
      label: "Profile",
      href: "/profile",
      icon: faUser,
      children: [
        {
          label: "Profile Data",
          href: "/profile/edit",
          icon: faUserTie,
          alsoActiveFor: [
            "/profile/work-experience",
            "/profile/education",
            "/profile/skills",
            "/profile/side-projects",
            "/profile/languages",
            "/profile/references",
          ],
        },
        {
          label: "Resumes & CVs",
          href: "/profile/resume",
          icon: faFileAlt,
        },
        {
          label: "Share Links",
          href: "/profile/share",
          icon: faLink,
        },
      ],
    },
    {
      label: "Data & Settings",
      href: "/data",
      icon: faCog,
      children: [
        {
          label: "Import & Export",
          href: "/data/profile-import",
          icon: faExchangeAlt,
          alsoActiveFor: [
            "/data/profile-export",
            "/data/settings-import",
            "/data/settings-export",
          ],
        },
        {
          label: "Account",
          href: "/data/account",
          icon: faWrench,
        },
      ],
    },
  ];

  const adminMenuItems: MenuItem[] = [
    {
      label: "Admin",
      href: "/admin",
      icon: faShieldAlt,
      children: [
        {
          label: "Users",
          href: "/admin/users",
          icon: faUsers,
        },
        {
          label: "Scraper",
          href: "/admin/scraper",
          icon: faSearch,
        },
        {
          label: "Job Platforms",
          href: "/admin/job-platforms",
          icon: faBriefcase,
        },
        {
          label: "Platform Discovery",
          href: "/admin/job-platforms/search-form-probe",
          icon: faBinoculars,
        },
        {
          label: "Matcher",
          href: "/admin/matcher",
          icon: faChartBar,
        },
        {
          label: "Scraper Agent",
          href: "/admin/scraper-agent",
          icon: faRobot,
        },
        {
          label: "AI Chats",
          href: "/admin/ai-chats",
          icon: faComments,
        },
        {
          label: "Feedback",
          href: "/admin/feedback",
          icon: faCommentDots,
        },
        {
          label: "Files",
          href: "/admin/files",
          icon: faFileAlt,
        },
        {
          label: "Inbox",
          href: "/admin/inbox",
          icon: faEnvelope,
        },
        {
          label: "Emails",
          href: "/admin/emails",
          icon: faPaperPlane,
        },
        {
          label: "Costs",
          href: "/admin/costs",
          icon: faChartLine,
        },
        {
          label: "Style Guide",
          href: "/admin/style-guide",
          icon: faPalette,
        },
      ],
    },
  ];

  let isAdmin = $derived(
    ($page.data.user as { is_admin?: boolean })?.is_admin ?? false,
  );

  let menuItems = $derived(baseMenuItems);

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

    // Application detail pages (/applications/123/...) → highlight "All Applications"
    if (currentPath.match(/^\/applications\/\d+/) && href === "/applications/active") {
      return true;
    }

    // Job detail pages (/jobs/123) - check jobCategory from page data
    const jobDetailMatch = currentPath.match(/^\/jobs\/(\d+)$/);
    if (jobDetailMatch) {
      const jobCategory = $page.data?.jobCategory;
      if (href === "/jobs?status=saved" && jobCategory === "saved") {
        return true;
      }
      if (href === "/jobs?minScore=50" && jobCategory === "matches") {
        return true;
      }
      if (href === "/jobs" && (jobCategory === "all" || !jobCategory)) {
        return true;
      }
      return false;
    }

    // Jobs list page - determine which sidebar item is active based on current params
    if (currentPath === "/jobs" && hrefPath === "/jobs") {
      const hasStatus = currentParams.has("status");
      const hasMinScore = currentParams.has("minScore");

      if (href === "/jobs?status=saved") {
        return hasStatus && currentParams.get("status")!.includes("saved");
      }
      if (href === "/jobs?minScore=50") {
        return hasMinScore && !hasStatus;
      }
      if (href === "/jobs") {
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

    // Subpath matching - but NOT for /jobs (All Jobs)
    if (href !== "/jobs" && currentPath.startsWith(href + "/")) {
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

    const allItems = isAdmin ? [...menuItems, ...adminMenuItems] : menuItems;
    for (const item of allItems) {
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

  function isActive(href: string, alsoActiveFor?: string[]): boolean {
    const currentPath = $page.url.pathname;
    const currentSearch = $page.url.search;
    if (href === "/home") {
      return currentPath === "/home";
    }
    if (isChildHrefActive(href, currentPath, currentSearch)) return true;
    if (alsoActiveFor?.some((p) => isChildHrefActive(p, currentPath, currentSearch))) return true;
    return false;
  }

  function isChildActive(item: MenuItem): boolean {
    if (!item.children) return false;
    return item.children.some((child) => isActive(child.href, child.alsoActiveFor));
  }

  function closeMobileMenu() {
    sidebarState.mobileOpen = false;
    overlayState.onclose = null;
  }

  function toggleMobileMenu() {
    // Close any open header dropdown first
    overlayState.onclose?.();
    sidebarState.mobileOpen = !sidebarState.mobileOpen;
    if (sidebarState.mobileOpen) {
      overlayState.onclose = closeMobileMenu;
    } else {
      overlayState.onclose = null;
    }
  }
</script>

<!-- Mobile menu button -->
<button
  type="button"
  onclick={toggleMobileMenu}
  class="lg:hidden fixed bottom-4 right-4 z-50 w-14 h-14 bg-[var(--dash-primary)] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-[var(--dash-primary-hover)] transition-colors"
  aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
>
  <FontAwesomeIcon icon={mobileMenuOpen ? faTimes : faBars} class="w-6 h-6" />
</button>

<!-- Sidebar -->
<aside
  class="
    fixed left-0 w-56 bg-[var(--dash-card)] border-r border-[var(--dash-border)] z-40 transform transition-transform duration-200 ease-in-out
    lg:translate-x-0 {mobileMenuOpen
    ? 'translate-x-0'
    : '-translate-x-full'}
  "
  style="top: calc(65px + var(--imp-offset, 0px)); height: calc(100vh - 65px - var(--imp-offset, 0px))"
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
                          child.href, child.alsoActiveFor,
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
                  item.href, item.alsoActiveFor,
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

    <!-- Plan & Usage -->
    <div class="mt-3 pt-3 border-t border-[var(--dash-border)]">
      <a
        href="/billing"
        onclick={closeMobileMenu}
        class="
          flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors {$page.url.pathname.startsWith('/billing')
          ? 'bg-[var(--dash-primary)] text-white'
          : 'text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'}
        "
      >
        <FontAwesomeIcon icon={planIcon.icon} class="w-4 h-4 {$page.url.pathname.startsWith('/billing') ? planIcon.activeColor : planIcon.color}" />
        <span class="font-medium">{planLabel} Plan</span>
      </a>
      {#if creditBalance}
        {@const total = creditBalance.allowance + creditBalance.extra}
        {@const usedPct = total > 0 ? Math.min(100, Math.round((creditBalance.used / total) * 100)) : 0}
        {@const daysLeft = creditBalance.periodEnd ? Math.max(0, Math.ceil((new Date(creditBalance.periodEnd).getTime() - Date.now()) / 86400000)) : null}
        <a
          href="/billing"
          onclick={closeMobileMenu}
          class="block mt-1.5 mx-2.5 group"
          title="{usedPct}% used{daysLeft != null ? ` · resets in ${daysLeft}d` : ''}"
        >
          <div class="flex items-center justify-between text-[10px] text-[var(--dash-text-secondary)] mb-1">
            <span>{usedPct}% used</span>
            {#if daysLeft != null}<span>resets in {daysLeft}d</span>{/if}
          </div>
          <div class="h-1 bg-[var(--dash-border)] rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all {usedPct >= 90 ? 'bg-red-500' : usedPct >= 75 ? 'bg-amber-500' : 'bg-[var(--dash-primary)]'}"
              style="width: {usedPct}%"
            ></div>
          </div>
        </a>
      {/if}
    </div>

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

    <!-- Admin section -->
    {#if isAdmin}
      {@const adminItem = adminMenuItems[0]}
      <div class="mt-3 pt-3 border-t border-amber-500/30">
        <button
          type="button"
          onclick={() => toggleSection(adminItem.label)}
          class="
            w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm text-left transition-colors {isChildActive(
            adminItem,
            )
            ? 'bg-amber-500/15 text-amber-500'
            : 'text-amber-500/70 hover:bg-amber-500/10 hover:text-amber-500'}
          "
        >
          <div class="flex items-center gap-2">
            <FontAwesomeIcon icon={adminItem.icon} class="w-4 h-4" />
            <span class="font-medium">{adminItem.label}</span>
          </div>
          {#if expandedSections.has(adminItem.label)}
            <FontAwesomeIcon icon={faChevronDown} class="w-3 h-3" />
          {:else}
            <FontAwesomeIcon icon={faChevronRight} class="w-3 h-3" />
          {/if}
        </button>

        {#if adminItem.children && expandedSections.has(adminItem.label)}
          <ul class="mt-1 ml-4 pl-4 border-l border-amber-500/30 space-y-1">
            {#each adminItem.children as child}
              <li>
                <a
                  href={child.href}
                  onclick={closeMobileMenu}
                  class="
                    flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors {isActive(
                    child.href, child.alsoActiveFor,
                    )
                    ? 'bg-amber-500 text-white'
                    : 'text-amber-500/60 hover:bg-amber-500/10 hover:text-amber-500'}
                  "
                >
                  <FontAwesomeIcon icon={child.icon} class="w-4 h-4" />
                  <span class="text-sm">{child.label}</span>
                </a>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </nav>
</aside>
