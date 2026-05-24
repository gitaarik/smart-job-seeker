<script lang="ts">
  import {
    saveToCookie,
    switchTheme,
    themeState,
  } from "$lib/stores/theme.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCircleHalfStroke,
    faMoon,
    faSun,
  } from "@fortawesome/free-solid-svg-icons";
  import { track } from "$lib/tools/analytics";

  interface Props {
    variant?: "floating" | "inline";
  }

  let { variant = "floating" }: Props = $props();

  let showThemeIndicator = $state(false);
  let fadeTimeout: NodeJS.Timeout;

  // DOM class sync lives in the root layout — this component unmounts when the dropdown closes.
  $effect(() => {
    saveToCookie(themeState.preference);
  });

  function showIndicator() {
    clearTimeout(fadeTimeout);
    showThemeIndicator = true;
    fadeTimeout = setTimeout(() => {
      showThemeIndicator = false;
    }, 2000);
  }

  function handleToggleTheme() {
    switchTheme();
    track("SwitchTheme");
    if (variant === "floating") {
      showIndicator();
    }
  }

  function getTopOffset() {
    switch (themeState.preference) {
      case "light":
        return "top-0";
      case "dark":
        return "-top-10";
      case "auto":
        return "-top-20";
      default:
        return "top-0";
    }
  }

  function getIndicatorTopOffset() {
    switch (themeState.preference) {
      case "light":
        return "top-0";
      case "dark":
        return "-top-4";
      case "auto":
        return "-top-8";
      default:
        return "top-0";
    }
  }

  function getAriaLabel() {
    switch (themeState.preference) {
      case "light":
        return "Theme: Light (click to switch to Dark)";
      case "dark":
        return "Theme: Dark (click to switch to Auto)";
      case "auto":
        return `Theme: Auto (currently ${themeState.actual}, click to switch to Light)`;
      default:
        return "Toggle theme";
    }
  }

  function getThemeDisplayName() {
    switch (themeState.preference) {
      case "light":
        return "Light";
      case "dark":
        return "Dark";
      case "auto":
        return `Auto (${themeState.actual})`;
      default:
        return "Unknown";
    }
  }

  function getCurrentIcon() {
    switch (themeState.preference) {
      case "light":
        return faSun;
      case "dark":
        return faMoon;
      case "auto":
        return faCircleHalfStroke;
      default:
        return faSun;
    }
  }
</script>

{#if variant === "inline"}
  <!-- Inline variant for use in menus -->
  <button
    onclick={handleToggleTheme}
    class="flex items-center justify-between gap-3 w-full px-4 py-2 text-sm text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
    aria-label={getAriaLabel()}
  >
    <span class="flex items-center gap-2">
      <FontAwesomeIcon icon={getCurrentIcon()} class="w-4 h-4" />
      <span>Theme</span>
    </span>
    <span class="text-[var(--dash-text-secondary)]">{getThemeDisplayName()}</span>
  </button>
{:else}
  <!-- Floating variant (original) -->
  <div class="fixed top-4 right-4 z-50">
    <!-- Stylish theme indicator with slide-in animation -->
    <div
      class="absolute right-14 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-2 bg-glass-light border border-glass rounded-lg shadow-lg backdrop-blur-md transition-all duration-300 ease-out overflow-hidden {showThemeIndicator ? 'opacity-100' : 'opacity-0'}"
    >
      <div class="relative w-4 h-4 overflow-hidden">
        <span
          class="block absolute {getIndicatorTopOffset()} transition-[top] duration-250"
        >
          <!-- Light theme icon -->
          <span class="flex w-4 h-4 items-center justify-center">
            <FontAwesomeIcon icon={faSun} class="w-3 h-3" />
          </span>

          <!-- Dark theme icon -->
          <span class="flex w-4 h-4 items-center justify-center">
            <FontAwesomeIcon icon={faMoon} class="w-3 h-3" />
          </span>

          <!-- Auto theme icon -->
          <span class="flex w-4 h-4 items-center justify-center">
            <FontAwesomeIcon icon={faCircleHalfStroke} class="w-3 h-3" />
          </span>
        </span>
      </div>
      <span class="text-sm font-medium whitespace-nowrap">{getThemeDisplayName()}</span>
    </div>

    <!-- Theme switcher button -->
    <button
      class="relative block w-[42px] h-[42px] rounded-3xl border bg-glass-light border-glass cursor-pointer shadow transition-all duration-200 focus:outline-none overflow-hidden hover:scale-105 active:scale-95"
      aria-label={getAriaLabel()}
      title={getAriaLabel()}
      onclick={handleToggleTheme}
    >
      <span
        class="block absolute {getTopOffset()} transition-[top] duration-250"
      >
        <!-- Light theme icon -->
        <span class="flex w-10 h-10 items-center justify-center">
          <FontAwesomeIcon icon={faSun} class="w-4" />
        </span>

        <!-- Dark theme icon -->
        <span class="flex w-10 h-10 items-center justify-center">
          <FontAwesomeIcon icon={faMoon} class="w-4" />
        </span>

        <!-- Auto theme icon -->
        <span class="flex w-10 h-10 items-center justify-center">
          <FontAwesomeIcon icon={faCircleHalfStroke} class="w-4" />
        </span>
      </span>
    </button>
  </div>
{/if}

<style>
  @keyframes slideInFromRight {
    from {
      opacity: 0;
      transform: translateX(20px) translateY(-50%);
    }
    to {
      opacity: 1;
      transform: translateX(0) translateY(-50%);
    }
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
</style>
