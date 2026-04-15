<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { getAllIcons } from "$lib/data/job-icons";
  import CategoryPill from "$lib/components/CategoryPill.svelte";
  import Checkbox from "../../components/Checkbox.svelte";
  import RadioGroup from "../../components/RadioGroup.svelte";
  import ToggleSwitch from "../../components/ToggleSwitch.svelte";
  import FilterTabs from "../../components/FilterTabs.svelte";
  import TabNav from "../../components/TabNav.svelte";
  import {
    faArrowLeft,
    faArrowRight,
    faBan,
    faBars,
    faBell,
    faBook,
    faBookmark,
    faBriefcase,
    faBullseye,
    faBuilding,
    faCalendar,
    faCalendarDays,
    faCamera,
    faChartBar,
    faChartLine,
    faCheck,
    faCheckCircle,
    faChevronDown,
    faChevronLeft,
    faChevronRight,
    faChevronUp,
    faCircle,
    faClipboardList,
    faCloud,
    faCloudUploadAlt,
    faCode,
    faCog,
    faComments,
    faCopy,
    faDatabase,
    faDesktop,
    faDownload,
    faEnvelope,
    faExclamationTriangle,
    faExternalLink,
    faExternalLinkAlt,
    faEye,
    faEyeSlash,
    faFile,
    faFileAlt,
    faFileArchive,
    faFileImport,
    faForward,
    faGauge,
    faGlobe,
    faGraduationCap,
    faGripVertical,
    faHistory,
    faHome,
    faImage,
    faKey,
    faLayerGroup,
    faLightbulb,
    faLink,
    faListCheck,
    faLocationDot,
    faMapMarkerAlt,
    faMoneyBillWave,
    faPaperPlane,
    faPalette,
    faPencil,
    faPlay,
    faPlus,
    faQuestionCircle,
    faQuoteLeft,
    faRotate,
    faSearch,
    faShieldAlt,
    faSignOutAlt,
    faSitemap,
    faSliders,
    faSpinner,
    faStop,
    faStickyNote,
    faSync,
    faTag,
    faTimes,
    faTimesCircle,
    faTrash,
    faUndo,
    faUser,
    faUserFriends,
    faUserSecret,
    faUsers,
    faUserTie,
    faWrench,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import {
    faClock,
    faStar as faStarRegular,
    faTimesCircle as faTimesCircleRegular,
  } from "@fortawesome/free-regular-svg-icons";
  import {
    faGithub,
    faLinkedin,
    faNpm,
    faPython,
    faStackOverflow,
  } from "@fortawesome/free-brands-svg-icons";
  import { faStar } from "@fortawesome/free-solid-svg-icons";
  import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import Card from "../../components/Card.svelte";
  import Spinner from "$lib/components/Spinner.svelte";

  // Group icons by category for display
  const iconGroups: { label: string; icons: { name: string; icon: IconDefinition }[] }[] = [
    {
      label: "Navigation",
      icons: [
        { name: "faHome", icon: faHome },
        { name: "faArrowLeft", icon: faArrowLeft },
        { name: "faArrowRight", icon: faArrowRight },
        { name: "faChevronDown", icon: faChevronDown },
        { name: "faChevronUp", icon: faChevronUp },
        { name: "faChevronLeft", icon: faChevronLeft },
        { name: "faChevronRight", icon: faChevronRight },
        { name: "faBars", icon: faBars },
        { name: "faTimes", icon: faTimes },
        { name: "faXmark", icon: faXmark },
        { name: "faExternalLink", icon: faExternalLink },
        { name: "faExternalLinkAlt", icon: faExternalLinkAlt },
        { name: "faSearch", icon: faSearch },
      ],
    },
    {
      label: "Actions",
      icons: [
        { name: "faPlus", icon: faPlus },
        { name: "faPencil", icon: faPencil },
        { name: "faTrash", icon: faTrash },
        { name: "faCopy", icon: faCopy },
        { name: "faDownload", icon: faDownload },
        { name: "faCloudUploadAlt", icon: faCloudUploadAlt },
        { name: "faFileImport", icon: faFileImport },
        { name: "faPlay", icon: faPlay },
        { name: "faStop", icon: faStop },
        { name: "faForward", icon: faForward },
        { name: "faSync", icon: faSync },
        { name: "faRotate", icon: faRotate },
        { name: "faUndo", icon: faUndo },
        { name: "faSave (faCheck)", icon: faCheck },
        { name: "faBan", icon: faBan },
        { name: "faSignOutAlt", icon: faSignOutAlt },
      ],
    },
    {
      label: "Status & Feedback",
      icons: [
        { name: "faSpinner", icon: faSpinner },
        { name: "faCheckCircle", icon: faCheckCircle },
        { name: "faTimesCircle", icon: faTimesCircle },
        { name: "faExclamationTriangle", icon: faExclamationTriangle },
        { name: "faCircle", icon: faCircle },
        { name: "faBell", icon: faBell },
        { name: "faLightbulb", icon: faLightbulb },
        { name: "faEye", icon: faEye },
        { name: "faEyeSlash", icon: faEyeSlash },
        { name: "faGauge", icon: faGauge },
      ],
    },
    {
      label: "Content & Data",
      icons: [
        { name: "faFile", icon: faFile },
        { name: "faFileAlt", icon: faFileAlt },
        { name: "faFileArchive", icon: faFileArchive },
        { name: "faBook", icon: faBook },
        { name: "faImage", icon: faImage },
        { name: "faCamera", icon: faCamera },
        { name: "faLink", icon: faLink },
        { name: "faTag", icon: faTag },
        { name: "faDatabase", icon: faDatabase },
        { name: "faChartBar", icon: faChartBar },
        { name: "faQuoteLeft", icon: faQuoteLeft },
        { name: "faGripVertical", icon: faGripVertical },
      ],
    },
    {
      label: "Dashboard Sections",
      icons: [
        { name: "faBriefcase", icon: faBriefcase },
        { name: "faBullseye", icon: faBullseye },
        { name: "faListCheck", icon: faListCheck },
        { name: "faBookmark", icon: faBookmark },
        { name: "faPaperPlane", icon: faPaperPlane },
        { name: "faEnvelope", icon: faEnvelope },
        { name: "faMoneyBillWave", icon: faMoneyBillWave },
        { name: "faUserTie", icon: faUserTie },
        { name: "faComments", icon: faComments },
        { name: "faStickyNote", icon: faStickyNote },
        { name: "faUser", icon: faUser },
        { name: "faUsers", icon: faUsers },
        { name: "faUserFriends", icon: faUserFriends },
        { name: "faUserSecret", icon: faUserSecret },
        { name: "faCog", icon: faCog },
        { name: "faSliders", icon: faSliders },
        { name: "faShieldAlt", icon: faShieldAlt },
        { name: "faDesktop", icon: faDesktop },
      ],
    },
    {
      label: "Job & Profile",
      icons: [
        { name: "faBuilding", icon: faBuilding },
        { name: "faLocationDot", icon: faLocationDot },
        { name: "faMapMarkerAlt", icon: faMapMarkerAlt },
        { name: "faCalendar", icon: faCalendar },
        { name: "faCalendarDays", icon: faCalendarDays },
        { name: "faGlobe", icon: faGlobe },
        { name: "faGraduationCap", icon: faGraduationCap },
        { name: "faCode", icon: faCode },
        { name: "faWrench", icon: faWrench },
        { name: "faCloud", icon: faCloud },
        { name: "faKey", icon: faKey },
        { name: "faHistory", icon: faHistory },
        { name: "faSitemap", icon: faSitemap },
        { name: "faLayerGroup", icon: faLayerGroup },
        { name: "faStar (solid)", icon: faStar },
      ],
    },
    {
      label: "Regular (outlined)",
      icons: [
        { name: "faClock", icon: faClock },
        { name: "faStar (regular)", icon: faStarRegular },
        { name: "faTimesCircle (regular)", icon: faTimesCircleRegular },
      ],
    },
    {
      label: "Brands",
      icons: [
        { name: "faGithub", icon: faGithub },
        { name: "faLinkedin", icon: faLinkedin },
        { name: "faNpm", icon: faNpm },
        { name: "faPython", icon: faPython },
        { name: "faStackOverflow", icon: faStackOverflow },
      ],
    },
  ];

  // Selection control demo state
  let segmentedValue = $state("option_b");
  let chipValue = $state("cover_letter");

  const segmentedOptions = [
    { value: "option_a", label: "Option A" },
    { value: "option_b", label: "Option B" },
    { value: "option_c", label: "Option C" },
  ];

  const chipOptions = [
    { value: "cover_letter", label: "Cover Letter" },
    { value: "follow_up", label: "Follow-up" },
    { value: "thank_you", label: "Thank You" },
    { value: "introduction", label: "Introduction" },
  ];

  let checkboxValues = $state<Set<string>>(new Set(["frontend", "typescript"]));

  const checkboxOptions = [
    { value: "frontend", label: "Frontend" },
    { value: "backend", label: "Backend" },
    { value: "typescript", label: "TypeScript" },
    { value: "python", label: "Python" },
    { value: "devops", label: "DevOps" },
    { value: "databases", label: "Databases" },
  ];

  function toggleCheckbox(value: string) {
    if (checkboxValues.has(value)) {
      checkboxValues.delete(value);
    } else {
      checkboxValues.add(value);
    }
    checkboxValues = new Set(checkboxValues);
  }

  // Checkbox demo
  let checkboxA = $state(true);
  let checkboxB = $state(false);
  let checkboxC = $state(true);

  // RadioGroup demo
  let radioValue = $state("hybrid");
  const radioOptions = [
    { value: "remote", label: "Remote" },
    { value: "hybrid", label: "Hybrid" },
    { value: "onsite", label: "On-site" },
  ];

  // ToggleSwitch demo
  let toggleBasic = $state(false);
  let toggleWithLabel = $state(true);
  let toggleDisabled = $state(false);

  // FilterTabs demo
  let filterValue = $state("all");
  const filterOptions = [
    { value: "all", label: "All", icon: faLayerGroup },
    { value: "letters", label: "Letters", icon: faEnvelope },
    { value: "questions", label: "Questions", icon: faQuestionCircle },
  ];

  let filterValueNoIcons = $state("active");
  const filterOptionsNoIcons = [
    { value: "active", label: "Active" },
    { value: "archived", label: "Archived" },
  ];

  // TabNav demo
  let activeTab = $state("#overview");
  const tabNavTabs = [
    { label: "Overview", href: "#overview", icon: faClipboardList },
    { label: "Applications", href: "#applications", icon: faBriefcase },
    { label: "Analytics", href: "#analytics", icon: faChartLine },
    { label: "Documents", href: "#documents", icon: faFileAlt },
    { label: "Salary", href: "#salary", icon: faMoneyBillWave },
    { label: "Timeline", href: "#timeline", icon: faHistory },
    { label: "Settings", href: "#settings", icon: faCog },
    { label: "Profile", href: "#profile", icon: faUser },
    { label: "Notifications", href: "#notifications", icon: faBell },
    { label: "Bookmarks", href: "#bookmarks", icon: faBookmark },
  ];

  const colorTokens = [
    { group: "Primary", tokens: [
      { name: "--dash-primary", label: "Primary" },
      { name: "--dash-primary-hover", label: "Primary Hover" },
      { name: "--dash-primary-light", label: "Primary Light" },
    ]},
    { group: "Chrome", tokens: [
      { name: "--dash-chrome", label: "Chrome" },
      { name: "--dash-chrome-hover", label: "Chrome Hover" },
      { name: "--dash-chrome-text", label: "Chrome Text" },
    ]},
    { group: "Backgrounds", tokens: [
      { name: "--dash-bg", label: "Background" },
      { name: "--dash-bg-inset", label: "Background Inset" },
      { name: "--dash-card", label: "Card" },
    ]},
    { group: "Borders", tokens: [
      { name: "--dash-border", label: "Border" },
      { name: "--dash-border-input", label: "Input Border" },
    ]},
    { group: "Text", tokens: [
      { name: "--dash-text", label: "Text" },
      { name: "--dash-text-secondary", label: "Text Secondary" },
      { name: "--dash-text-muted", label: "Text Muted" },
    ]},
    { group: "Semantic", tokens: [
      { name: "--dash-error", label: "Error" },
      { name: "--dash-error-light", label: "Error Light" },
      { name: "--dash-success", label: "Success" },
      { name: "--dash-success-light", label: "Success Light" },
      { name: "--dash-warning", label: "Warning" },
      { name: "--dash-warning-light", label: "Warning Light" },
      { name: "--dash-info", label: "Info" },
      { name: "--dash-info-light", label: "Info Light" },
      { name: "--dash-purple", label: "Purple" },
      { name: "--dash-purple-light", label: "Purple Light" },
    ]},
  ];
</script>

<div class="space-y-8">
  <SectionHeader title="Style Guide" icon={faPalette} />

  <!-- Logo -->
  <section>
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-3">Logo</h2>

    <!-- Logo with text -->
    <Card padding="responsive" class="mb-3">
      <h3 class="text-sm font-medium text-[var(--dash-text)] mb-4">Logo with Text</h3>
      <div class="flex flex-wrap gap-6">
        <!-- Light background -->
        <div class="flex flex-col items-center gap-2">
          <div class="flex items-center gap-3 px-6 py-4 rounded-lg border border-[var(--dash-border)]">
            <svg class="h-10 w-10" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="12" stroke="#4f46e5" stroke-width="3" fill="none"/>
              <line x1="25" y1="25" x2="36" y2="36" stroke="#4f46e5" stroke-width="4" stroke-linecap="round"/>
              <path d="M10 17l4 4 8-8" stroke="#4f46e5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
            <span class="font-semibold tracking-wide uppercase text-[var(--dash-text)]">Smart Job Seeker</span>
          </div>
          <span class="text-xs text-[var(--dash-text-muted)]">Light background</span>
        </div>
        <!-- Indigo header -->
        <div class="flex flex-col items-center gap-2">
          <div class="flex items-center gap-3 px-6 py-4 rounded-lg bg-[var(--dash-chrome)]">
            <svg class="h-10 w-10" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="12" stroke="#ffffff" stroke-width="3" fill="none"/>
              <line x1="25" y1="25" x2="36" y2="36" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
              <path d="M10 17l4 4 8-8" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
            <span class="font-semibold tracking-wide uppercase text-white">Smart Job Seeker</span>
          </div>
          <span class="text-xs text-[var(--dash-text-muted)]">Indigo header</span>
        </div>
        <!-- Dark background -->
        <div class="flex flex-col items-center gap-2">
          <div class="flex items-center gap-3 px-6 py-4 rounded-lg bg-gray-800">
            <svg class="h-10 w-10" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="12" stroke="#ffffff" stroke-width="3" fill="none"/>
              <line x1="25" y1="25" x2="36" y2="36" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
              <path d="M10 17l4 4 8-8" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
            <span class="font-semibold tracking-wide uppercase text-white">Smart Job Seeker</span>
          </div>
          <span class="text-xs text-[var(--dash-text-muted)]">Dark background</span>
        </div>
      </div>
    </Card>

    <!-- Icon only -->
    <Card padding="responsive" class="mb-3">
      <h3 class="text-sm font-medium text-[var(--dash-text)] mb-4">Icon Only</h3>
      <div class="flex flex-wrap items-end gap-10">
        <div class="flex flex-col items-center gap-2">
          <svg class="h-16 w-16" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="12" stroke="#4f46e5" stroke-width="3" fill="none"/>
            <line x1="25" y1="25" x2="36" y2="36" stroke="#4f46e5" stroke-width="4" stroke-linecap="round"/>
            <path d="M10 17l4 4 8-8" stroke="#4f46e5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          <span class="text-xs text-[var(--dash-text-muted)]">64px</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <svg class="h-12 w-12" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="12" stroke="#4f46e5" stroke-width="3" fill="none"/>
            <line x1="25" y1="25" x2="36" y2="36" stroke="#4f46e5" stroke-width="4" stroke-linecap="round"/>
            <path d="M10 17l4 4 8-8" stroke="#4f46e5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          <span class="text-xs text-[var(--dash-text-muted)]">48px</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <svg class="h-9 w-9" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="12" stroke="#4f46e5" stroke-width="3" fill="none"/>
            <line x1="25" y1="25" x2="36" y2="36" stroke="#4f46e5" stroke-width="4" stroke-linecap="round"/>
            <path d="M10 17l4 4 8-8" stroke="#4f46e5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          <span class="text-xs text-[var(--dash-text-muted)]">36px (header)</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <svg class="h-7 w-7" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="12" stroke="#4f46e5" stroke-width="3" fill="none"/>
            <line x1="25" y1="25" x2="36" y2="36" stroke="#4f46e5" stroke-width="4" stroke-linecap="round"/>
            <path d="M10 17l4 4 8-8" stroke="#4f46e5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          <span class="text-xs text-[var(--dash-text-muted)]">28px</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <svg class="h-4 w-4" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="12" stroke="#4f46e5" stroke-width="3" fill="none"/>
            <line x1="25" y1="25" x2="36" y2="36" stroke="#4f46e5" stroke-width="4" stroke-linecap="round"/>
            <path d="M10 17l4 4 8-8" stroke="#4f46e5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          <span class="text-xs text-[var(--dash-text-muted)]">16px (favicon)</span>
        </div>
      </div>
    </Card>

    <!-- SVG assets -->
    <Card padding="responsive">
      <h3 class="text-sm font-medium text-[var(--dash-text)] mb-2">SVG Assets</h3>
      <div class="flex flex-wrap gap-4 text-xs text-[var(--dash-text-secondary)]">
        <a href="/brand/logo-indigo.svg" target="_blank" class="text-[var(--dash-primary)] hover:underline">/brand/logo-indigo.svg</a>
        <a href="/brand/logo-white.svg" target="_blank" class="text-[var(--dash-primary)] hover:underline">/brand/logo-white.svg</a>
      </div>
      <p class="text-xs text-[var(--dash-text-muted)] mt-2">
        Uses <code class="text-[var(--dash-primary)]">currentColor</code> via stroke attribute. Set color with CSS <code class="text-[var(--dash-primary)]">color</code> or Tailwind <code class="text-[var(--dash-primary)]">text-*</code> classes.
      </p>
    </Card>
  </section>

  <!-- Color Tokens -->
  <section>
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-3">Color Tokens</h2>
    <div class="space-y-3">
      {#each colorTokens as group}
        <Card padding="responsive">
          <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">{group.group}</h3>
          <div class="flex flex-wrap gap-3">
            {#each group.tokens as token}
              <div class="flex items-center gap-2">
                <div
                  class="w-8 h-8 rounded border border-[var(--dash-border)]"
                  style="background: var({token.name})"
                ></div>
                <div>
                  <div class="text-xs font-medium text-[var(--dash-text)]">{token.label}</div>
                  <div class="text-xs text-[var(--dash-text-muted)] font-mono">{token.name}</div>
                </div>
              </div>
            {/each}
          </div>
        </Card>
      {/each}
    </div>
  </section>

  <!-- Typography -->
  <section>
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-3">Typography</h2>
    <Card padding="responsive">
      <div class="space-y-3">
        <div>
          <h1 class="text-2xl font-bold text-[var(--dash-text)]">Page Title (text-2xl bold)</h1>
        </div>
        <div>
          <h2 class="text-lg font-semibold text-[var(--dash-text)]">Section Title (text-lg semibold)</h2>
        </div>
        <div>
          <h3 class="text-sm font-medium text-[var(--dash-text)]">Card Title (text-sm medium)</h3>
        </div>
        <div>
          <p class="text-sm text-[var(--dash-text)]">Body text (text-sm)</p>
        </div>
        <div>
          <p class="text-sm text-[var(--dash-text-secondary)]">Secondary text (text-sm, --dash-text-secondary)</p>
        </div>
        <div>
          <p class="text-xs text-[var(--dash-text-muted)]">Muted / caption text (text-xs, --dash-text-muted)</p>
        </div>
        <div>
          <code class="text-xs text-[var(--dash-primary)] bg-[var(--dash-bg)] px-1.5 py-0.5 rounded">Inline code</code>
        </div>
      </div>
      <p class="text-xs text-[var(--dash-text-muted)] mt-4">
        Font: Noto Sans (300–700). All text uses CSS variable colors.
      </p>
    </Card>
  </section>

  <!-- Loading States -->
  <section>
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-3">Loading States</h2>
    <Card padding="responsive">
      <div class="flex flex-wrap items-start gap-8">
        <!-- Custom spinner -->
        <div class="flex flex-col items-center gap-2">
          <Spinner size="w-6 h-6" color="var(--dash-primary)" />
          <span class="text-xs text-[var(--dash-text-muted)]">Spinner (default)</span>
        </div>
        <!-- Small spinner -->
        <div class="flex flex-col items-center gap-2">
          <Spinner size="w-4 h-4" color="var(--dash-primary)" />
          <span class="text-xs text-[var(--dash-text-muted)]">Spinner (small)</span>
        </div>
        <!-- Inline spinner -->
        <div class="flex flex-col items-center gap-2">
          <Spinner size="w-3 h-3" />
          <span class="text-xs text-[var(--dash-text-muted)]">Spinner (inline)</span>
        </div>
        <!-- Spinner in button -->
        <div class="flex flex-col items-center gap-2">
          <button
            type="button"
            disabled
            class="flex items-center gap-2 px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg opacity-70 cursor-not-allowed"
          >
            <Spinner size="w-4 h-4" color="white" />
            <span class="text-sm">Saving...</span>
          </button>
          <span class="text-xs text-[var(--dash-text-muted)]">Button loading</span>
        </div>
        <!-- Muted spinner -->
        <div class="flex flex-col items-center gap-2">
          <Spinner size="w-5 h-5" color="var(--dash-text-muted)" />
          <span class="text-xs text-[var(--dash-text-muted)]">Muted</span>
        </div>
        <!-- Live indicator -->
        <div class="flex flex-col items-center gap-2">
          <span class="relative flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span class="text-xs text-[var(--dash-text-muted)]">Live indicator</span>
        </div>
        <!-- Idle indicator -->
        <div class="flex flex-col items-center gap-2">
          <span class="relative flex h-3 w-3">
            <span class="relative inline-flex rounded-full h-3 w-3 bg-gray-400"></span>
          </span>
          <span class="text-xs text-[var(--dash-text-muted)]">Idle indicator</span>
        </div>
        <!-- Active (no ping) -->
        <div class="flex flex-col items-center gap-2">
          <span class="relative flex h-3 w-3">
            <span class="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
          </span>
          <span class="text-xs text-[var(--dash-text-muted)]">Active (waiting)</span>
        </div>
      </div>

      <!-- Inline usage examples -->
      <div class="mt-6 space-y-3 border-t border-[var(--dash-border)] pt-4">
        <h3 class="text-sm font-medium text-[var(--dash-text)]">Usage</h3>
        <div class="text-xs font-mono text-[var(--dash-text-secondary)] bg-[var(--dash-bg)] p-3 rounded overflow-x-auto">
          &lt;Spinner size="w-6 h-6" color="var(--dash-primary)" /&gt;
        </div>
        <div class="text-xs font-mono text-[var(--dash-text-secondary)] bg-[var(--dash-bg)] p-3 rounded overflow-x-auto">
          &lt;Spinner size="w-4 h-4" color="white" /&gt;  &lt;!-- in buttons --&gt;
        </div>
        <div class="text-xs font-mono text-[var(--dash-text-secondary)] bg-[var(--dash-bg)] p-3 rounded overflow-x-auto">
          &lt;Spinner /&gt;  &lt;!-- inherits text color, w-4 h-4 default --&gt;
        </div>
      </div>
    </Card>
  </section>

  <!-- Buttons -->
  <section>
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-3">Buttons</h2>
    <Card padding="responsive">
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors text-sm"
        >Primary</button>
        <button
          type="button"
          class="px-4 py-2 border border-[var(--dash-border)] text-[var(--dash-text)] rounded-lg hover:bg-[var(--dash-bg)] transition-colors text-sm"
        >Secondary</button>
        <button
          type="button"
          class="px-4 py-2 bg-[var(--dash-error)] text-white rounded-lg hover:opacity-90 transition-colors text-sm"
        >Danger</button>
        <button
          type="button"
          class="px-4 py-2 bg-[var(--dash-success)] text-white rounded-lg hover:opacity-90 transition-colors text-sm"
        >Success</button>
        <button
          type="button"
          class="text-sm text-[var(--dash-primary)] hover:underline"
        >Text Link</button>
        <button
          type="button"
          disabled
          class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg opacity-50 cursor-not-allowed text-sm"
        >Disabled</button>
      </div>

      <div class="flex flex-wrap items-center gap-3 mt-4">
        <button
          type="button"
          class="flex items-center gap-2 px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors text-sm"
        >
          <FontAwesomeIcon icon={faPlus} class="w-4 h-4" />
          With Icon
        </button>
        <button
          type="button"
          class="flex items-center justify-center w-10 h-10 bg-[var(--dash-primary)] text-white rounded-full hover:bg-[var(--dash-primary-hover)] transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} class="w-5 h-5" />
        </button>
        <span class="text-xs px-2 py-1 rounded-full bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]">Badge</span>
        <span class="text-xs px-2 py-1 rounded-full bg-[var(--dash-success-light)] text-[var(--dash-success)]">Success badge</span>
        <span class="text-xs px-2 py-1 rounded-full bg-[var(--dash-error-light)] text-[var(--dash-error)]">Error badge</span>
        <span class="text-xs px-2 py-1 rounded-full bg-[var(--dash-warning-light)] text-[var(--dash-warning)]">Warning badge</span>
      </div>
    </Card>
  </section>

  <!-- Selection Controls -->
  <section>
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-3">Selection Controls</h2>
    <div class="space-y-3">
      <!-- Segmented Control -->
      <Card padding="responsive">
        <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">Segmented Control</h3>
        <p class="text-xs text-[var(--dash-text-secondary)] mb-4">
          Best for 2–4 short options. All options visible at once. Not suitable for long labels or many items — will overflow on mobile.
        </p>
        <div class="inline-flex rounded-lg border border-[var(--dash-border)] overflow-hidden">
          {#each segmentedOptions as opt, i}
            <button
              type="button"
              onclick={() => (segmentedValue = opt.value)}
              class="px-3 py-2 text-sm transition-colors {segmentedValue === opt.value
                ? 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] font-medium'
                : 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]'} {i > 0 ? 'border-l border-[var(--dash-border)]' : ''}"
            >
              {opt.label}
            </button>
          {/each}
        </div>
        <p class="text-xs text-[var(--dash-text-muted)] mt-3">Selected: <code class="text-[var(--dash-primary)]">{segmentedValue}</code></p>
      </Card>

      <!-- Chip / Pill Selector -->
      <Card padding="responsive">
        <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">Chip Selector</h3>
        <p class="text-xs text-[var(--dash-text-secondary)] mb-4">
          Best for any number of options, including long labels. Wraps naturally on mobile. Radio dot makes it clearly a selection control, not an action button.
        </p>
        <div class="flex flex-wrap gap-2">
          {#each chipOptions as opt}
            <button
              type="button"
              onclick={() => (chipValue = opt.value)}
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors {chipValue === opt.value
                ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
                : 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
            >
              <span class="w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 {chipValue === opt.value
                ? 'border-[var(--dash-primary)]'
                : 'border-[var(--dash-border)]'}">
                {#if chipValue === opt.value}
                  <span class="w-2 h-2 rounded-full bg-[var(--dash-primary)]"></span>
                {/if}
              </span>
              {opt.label}
            </button>
          {/each}
        </div>
        <p class="text-xs text-[var(--dash-text-muted)] mt-3">Selected: <code class="text-[var(--dash-primary)]">{chipValue}</code></p>
      </Card>

      <!-- Checkbox Chips -->
      <Card padding="responsive">
        <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">Checkbox Chips (Multi-select)</h3>
        <p class="text-xs text-[var(--dash-text-secondary)] mb-4">
          Same wrapping pill style but for multi-select. Uses a checkmark square instead of a radio dot to signal multiple selection.
        </p>
        <div class="flex flex-wrap gap-2">
          {#each checkboxOptions as opt}
            <button
              type="button"
              onclick={() => toggleCheckbox(opt.value)}
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors {checkboxValues.has(opt.value)
                ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
                : 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
            >
              <span class="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 {checkboxValues.has(opt.value)
                ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]'
                : 'border-[var(--dash-border)]'}">
                {#if checkboxValues.has(opt.value)}
                  <FontAwesomeIcon icon={faCheck} class="w-2.5 h-2.5 text-white" />
                {/if}
              </span>
              {opt.label}
            </button>
          {/each}
        </div>
        <p class="text-xs text-[var(--dash-text-muted)] mt-3">Selected: <code class="text-[var(--dash-primary)]">{[...checkboxValues].join(", ")}</code></p>
      </Card>
    </div>
  </section>

  <!-- Form Controls -->
  <section>
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-3">Form Controls</h2>
    <div class="space-y-3">
      <!-- Checkbox -->
      <Card padding="responsive">
        <h3 class="text-sm font-medium text-[var(--dash-text)] mb-1">Checkbox</h3>
        <p class="text-xs text-[var(--dash-text-secondary)] mb-4">
          Standard checkbox with label. Use for multi-select options and toggleable settings. Value is bindable.
        </p>

        <div class="space-y-5">
          <div>
            <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Inline group</p>
            <div class="flex flex-wrap gap-x-4 gap-y-2">
              <Checkbox bind:checked={checkboxA} label="Remote" />
              <Checkbox bind:checked={checkboxB} label="Hybrid" />
              <Checkbox bind:checked={checkboxC} label="On-site" />
            </div>
            <p class="text-xs text-[var(--dash-text-muted)] mt-2">Selected: {[checkboxA && "Remote", checkboxB && "Hybrid", checkboxC && "On-site"].filter(Boolean).join(", ") || "none"}</p>
          </div>

          <div>
            <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Usage</p>
            <pre class="text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md p-3 overflow-x-auto"><code>{`<Checkbox bind:checked={value} label="Option" />`}</code></pre>
          </div>
        </div>
      </Card>

      <!-- RadioGroup -->
      <Card padding="responsive">
        <h3 class="text-sm font-medium text-[var(--dash-text)] mb-1">RadioGroup</h3>
        <p class="text-xs text-[var(--dash-text-secondary)] mb-4">
          Single-select radio buttons. Use for mutually exclusive choices. Value is bindable.
        </p>

        <div class="space-y-5">
          <div>
            <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Default</p>
            <RadioGroup options={radioOptions} bind:value={radioValue} />
            <p class="text-xs text-[var(--dash-text-muted)] mt-2">Selected: {radioValue}</p>
          </div>

          <div>
            <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Usage</p>
            <pre class="text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md p-3 overflow-x-auto"><code>{`<RadioGroup
  options={[
    { value: "remote", label: "Remote" },
    { value: "hybrid", label: "Hybrid" },
    { value: "onsite", label: "On-site" },
  ]}
  bind:value={selected}
/>`}</code></pre>
          </div>
        </div>
      </Card>

      <!-- ToggleSwitch -->
      <Card padding="responsive">
        <h3 class="text-sm font-medium text-[var(--dash-text)] mb-1">ToggleSwitch</h3>
        <p class="text-xs text-[var(--dash-text-secondary)] mb-4">
          On/off toggle. Supports label, description, and disabled state. Value is bindable.
        </p>

        <div class="space-y-5">
          <div>
            <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Basic</p>
            <ToggleSwitch bind:checked={toggleBasic} />
            <p class="text-xs text-[var(--dash-text-muted)] mt-2">Checked: {toggleBasic}</p>
          </div>

          <div>
            <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">With label and description</p>
            <ToggleSwitch
              bind:checked={toggleWithLabel}
              label="Enable feature"
              description="This enables an optional feature that does something useful"
            />
          </div>

          <div>
            <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Disabled</p>
            <ToggleSwitch bind:checked={toggleDisabled} label="Unavailable option" disabled />
          </div>

          <div>
            <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Usage</p>
            <pre class="text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md p-3 overflow-x-auto"><code>{`<ToggleSwitch
  bind:checked={enabled}
  label="Enable feature"
  description="Optional description text"
/>`}</code></pre>
          </div>
        </div>
      </Card>

      <!-- FilterTabs -->
      <Card padding="responsive">
        <h3 class="text-sm font-medium text-[var(--dash-text)] mb-1">FilterTabs</h3>
        <p class="text-xs text-[var(--dash-text-secondary)] mb-4">
          Single-select tabs for filtering or choosing between options. Icons are optional.
        </p>

        <div class="space-y-5">
          <div>
            <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">With icons</p>
            <FilterTabs filters={filterOptions} value={filterValue} onchange={(v) => (filterValue = v)} />
            <p class="text-xs text-[var(--dash-text-muted)] mt-2">Selected: {filterValue}</p>
          </div>

          <div>
            <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Without icons</p>
            <FilterTabs filters={filterOptionsNoIcons} value={filterValueNoIcons} onchange={(v) => (filterValueNoIcons = v)} />
            <p class="text-xs text-[var(--dash-text-muted)] mt-2">Selected: {filterValueNoIcons}</p>
          </div>

          <div>
            <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Usage</p>
            <pre class="text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md p-3 overflow-x-auto"><code>{`<FilterTabs
  filters={[
    { value: "all", label: "All", icon: faLayerGroup },
    { value: "letters", label: "Letters", icon: faEnvelope },
    { value: "questions", label: "Questions", icon: faQuestionCircle },
  ]}
  value={currentType}
  onchange={(v) => (currentType = v)}
/>`}</code></pre>
          </div>
        </div>
      </Card>
    </div>
  </section>

  <!-- TabNav -->
  <section>
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-3">TabNav</h2>
    <Card padding="responsive">
      <p class="text-xs text-[var(--dash-text-secondary)] mb-4">
        Navigation tabs with multi-row bookmark layout on small screens. Click a tab to change the active state.
      </p>

      <div class="space-y-5">
        <div>
          <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">10 tabs (forces multi-row on most screens)</p>
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="-mx-4 sm:-mx-6" onclick={(e) => {
            const a = (e.target as HTMLElement).closest("a[href^='#']");
            if (a) { e.preventDefault(); activeTab = a.getAttribute("href") || activeTab; }
          }}>
            <TabNav tabs={tabNavTabs} isActive={(href) => href === activeTab}>
              <div class="px-4 sm:px-6 py-4 text-sm text-[var(--dash-text-muted)]">
                Active tab: <strong class="text-[var(--dash-text)]">{activeTab}</strong>
              </div>
            </TabNav>
          </div>
        </div>
      </div>
    </Card>
  </section>

  <!-- Category Tag Pills -->
  <section>
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-3">Category Tag Pills</h2>
    <p class="text-sm text-[var(--dash-text-secondary)] mb-3">
      Colored tag pills with icons used on job cards, job detail pages, salary expectations, and match config. Each category has a distinct color. Icons resolve via the job taxonomy, handling non-canonical forms automatically.
    </p>
    <div class="space-y-3">
      <!-- Job Types -->
      <Card padding="responsive">
        <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">Job Type <span class="text-xs font-normal text-[var(--dash-text-muted)]">— emerald</span></h3>
        <div class="flex flex-wrap gap-2">
          {#each getAllIcons("job_type") as { value }}
            <CategoryPill category="job_type" {value} />
          {/each}
        </div>
      </Card>

      <!-- Work Location -->
      <Card padding="responsive">
        <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">Work Location <span class="text-xs font-normal text-[var(--dash-text-muted)]">— primary (blue)</span></h3>
        <div class="flex flex-wrap gap-2">
          {#each getAllIcons("work_location") as { value }}
            <CategoryPill category="work_location" {value} />
          {/each}
        </div>
      </Card>

      <!-- Experience Level -->
      <Card padding="responsive">
        <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">Experience Level <span class="text-xs font-normal text-[var(--dash-text-muted)]">— purple</span></h3>
        <div class="flex flex-wrap gap-2">
          {#each getAllIcons("experience_level") as { value }}
            <CategoryPill category="experience_level" {value} />
          {/each}
        </div>
      </Card>

      <!-- Usage -->
      <Card padding="responsive">
        <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">Usage</h3>
        <div class="space-y-3">
          <div class="text-xs font-mono text-[var(--dash-text-secondary)] bg-[var(--dash-bg)] p-3 rounded overflow-x-auto">
            import CategoryPill from "$lib/components/CategoryPill.svelte";
          </div>
          <div class="text-xs font-mono text-[var(--dash-text-secondary)] bg-[var(--dash-bg)] p-3 rounded overflow-x-auto">
            &lt;CategoryPill category="job_type" value="full_time" /&gt;
          </div>
          <p class="text-xs text-[var(--dash-text-muted)]">
            Normalizes non-canonical values (e.g. "Full-time", "contractor", "medior") through the job taxonomy automatically.
          </p>
        </div>
      </Card>
    </div>
  </section>

  <!-- Links -->
  <section>
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-3">Links</h2>
    <Card padding="responsive">
      <div class="space-y-4">
        <div>
          <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">External Link Pills</h3>
          <p class="text-xs text-[var(--dash-text-secondary)] mb-3">
            Use <code class="text-[var(--dash-primary)] bg-[var(--dash-bg)] px-1 py-0.5 rounded">.dash-link-ext</code> for prominent action links that open externally (previews, exports, documents).
          </p>
          <div class="flex flex-wrap gap-2">
            <a href="#" class="dash-link-ext">Resume</a>
            <a href="#" class="dash-link-ext">Resume PDF</a>
            <a href="#" class="dash-link-ext">CV</a>
            <a href="#" class="dash-link-ext">CV PDF</a>
          </div>
        </div>
        <div>
          <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">Inline Text Link</h3>
          <p class="text-xs text-[var(--dash-text-secondary)] mb-3">
            For links within body text, use <code class="text-[var(--dash-primary)] bg-[var(--dash-bg)] px-1 py-0.5 rounded">text-[var(--dash-primary)] hover:underline</code>.
          </p>
          <p class="text-sm text-[var(--dash-text)]">
            For trackable links with view limits, use <a href="#" class="text-[var(--dash-primary)] hover:underline">Private Links</a>.
          </p>
        </div>
      </div>

      <div class="mt-6 space-y-3 border-t border-[var(--dash-border)] pt-4">
        <h3 class="text-sm font-medium text-[var(--dash-text)]">Usage</h3>
        <div class="text-xs font-mono text-[var(--dash-text-secondary)] bg-[var(--dash-bg)] p-3 rounded overflow-x-auto">
          &lt;a href="..." target="_blank" class="dash-link-ext"&gt;Resume PDF&lt;/a&gt;
        </div>
      </div>
    </Card>
  </section>

  <!-- Cards -->
  <section>
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-3">Cards</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Card padding="responsive">
        <h3 class="text-sm font-medium text-[var(--dash-text)] mb-1">Default Card</h3>
        <p class="text-xs text-[var(--dash-text-secondary)]">padding="responsive" — p-4 on mobile, p-6 on desktop</p>
      </Card>
      <Card padding="sm">
        <h3 class="text-sm font-medium text-[var(--dash-text)] mb-1">Small Card</h3>
        <p class="text-xs text-[var(--dash-text-secondary)]">padding="sm" — p-3</p>
      </Card>
      <Card padding="responsive">
        <div class="flex items-center gap-3">
          <span class="relative flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span class="text-sm font-medium text-[var(--dash-success)]">Card with status</span>
        </div>
      </Card>
      <Card padding="responsive">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-[var(--dash-text)]">Card with action</h3>
          <button type="button" class="text-xs text-[var(--dash-primary)] hover:underline">View all</button>
        </div>
      </Card>
    </div>
  </section>

  <!-- Alerts / Status Messages -->
  <section>
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-3">Alerts</h2>
    <div class="space-y-3">
      <div class="p-3 rounded-lg bg-[var(--dash-info-light)] border border-[var(--dash-info)]/20">
        <div class="flex items-center gap-2">
          <FontAwesomeIcon icon={faCircle} class="w-3 h-3 text-[var(--dash-info)]" />
          <span class="text-sm text-[var(--dash-info)]">Info message — general information</span>
        </div>
      </div>
      <div class="p-3 rounded-lg bg-[var(--dash-success-light)] border border-[var(--dash-success)]/20">
        <div class="flex items-center gap-2">
          <FontAwesomeIcon icon={faCheckCircle} class="w-3.5 h-3.5 text-[var(--dash-success)]" />
          <span class="text-sm text-[var(--dash-success)]">Success — operation completed</span>
        </div>
      </div>
      <div class="p-3 rounded-lg bg-[var(--dash-warning-light)] border border-[var(--dash-warning)]/20">
        <div class="flex items-center gap-2">
          <FontAwesomeIcon icon={faExclamationTriangle} class="w-3.5 h-3.5 text-[var(--dash-warning)]" />
          <span class="text-sm text-[var(--dash-warning)]">Warning — something needs attention</span>
        </div>
      </div>
      <div class="p-3 rounded-lg bg-[var(--dash-error-light)] border border-[var(--dash-error)]/20">
        <div class="flex items-center gap-2">
          <FontAwesomeIcon icon={faTimesCircle} class="w-3.5 h-3.5 text-[var(--dash-error)]" />
          <span class="text-sm text-[var(--dash-error)]">Error — something went wrong</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Progress Bar -->
  <section>
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-3">Progress Bars</h2>
    <Card padding="responsive">
      <div class="space-y-4">
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs text-[var(--dash-text-secondary)]">In progress (65%)</span>
          </div>
          <div class="w-full bg-[var(--dash-bg)] rounded-full h-1.5 overflow-hidden">
            <div class="h-full rounded-full bg-[var(--dash-primary)] transition-all duration-500" style="width: 65%"></div>
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs text-[var(--dash-text-secondary)]">Complete (100%)</span>
          </div>
          <div class="w-full bg-[var(--dash-bg)] rounded-full h-1.5 overflow-hidden">
            <div class="h-full rounded-full bg-[var(--dash-success)] transition-all duration-500" style="width: 100%"></div>
          </div>
        </div>
      </div>
    </Card>
  </section>

  <!-- Icons -->
  <section>
    <h2 class="text-lg font-semibold text-[var(--dash-text)] mb-3">Icons</h2>
    <p class="text-sm text-[var(--dash-text-secondary)] mb-3">
      FontAwesome 6.7 — all icons currently used in the dashboard.
    </p>
    <div class="space-y-3">
      {#each iconGroups as group}
        <Card padding="responsive">
          <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">{group.label}</h3>
          <div class="flex flex-wrap gap-1.5">
            {#each group.icons as { name, icon }}
              <div
                class="group relative flex flex-col items-center justify-center w-14 h-14 rounded-lg hover:bg-[var(--dash-bg)] transition-colors cursor-default"
                title={name}
              >
                <FontAwesomeIcon {icon} class="w-5 h-5 text-[var(--dash-text-secondary)]" />
                <span class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-[var(--dash-text-muted)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {name.replace("fa", "")}
                </span>
              </div>
            {/each}
          </div>
        </Card>
      {/each}
    </div>
  </section>
</div>
