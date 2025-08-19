<script lang="ts">
  import { switchTheme, theme, themePreference } from "$lib/stores/theme";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faMoon, faSun, faCircleHalfStroke } from "@fortawesome/free-solid-svg-icons";
  import { track } from "$lib/tools/analytics";

  let showThemeIndicator = false;
  let fadeTimeout: NodeJS.Timeout;

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
    showIndicator();
  }

  function getTopOffset() {
    switch ($themePreference) {
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

  function getAriaLabel() {
    switch ($themePreference) {
      case "light":
        return "Theme: Light (click to switch to Dark)";
      case "dark":
        return "Theme: Dark (click to switch to Auto)";
      case "auto":
        return `Theme: Auto (currently ${$theme}, click to switch to Light)`;
      default:
        return "Toggle theme";
    }
  }

  function getThemeDisplayName() {
    switch ($themePreference) {
      case "light":
        return "Light";
      case "dark":
        return "Dark";
      case "auto":
        return `Auto (${$theme})`;
      default:
        return "Unknown";
    }
  }
</script>

<div class="fixed top-4 right-4 z-50">
  <!-- Theme indicator -->
  {#if showThemeIndicator}
    <div
      class="absolute right-14 top-0 px-3 py-2 bg-glass-light border border-glass rounded shadow-lg text-sm font-medium transition-opacity duration-500 whitespace-nowrap"
      class:opacity-0={!showThemeIndicator}
      class:opacity-100={showThemeIndicator}
    >
      {getThemeDisplayName()}
    </div>
  {/if}

  <!-- Theme switcher button -->
  <button
    class="block w-10 h-10 rounded border bg-glass-light border-glass cursor-pointer shadow transition focus:outline-none overflow-hidden"
    aria-label={getAriaLabel()}
    title={getAriaLabel()}
    on:click={handleToggleTheme}
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
