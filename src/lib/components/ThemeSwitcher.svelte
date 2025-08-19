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

  function getIndicatorTopOffset() {
    switch ($themePreference) {
      case "light":
        return "top-0";
      case "dark":
        return "-top-3";
      case "auto":
        return "-top-6";
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
  <!-- Stylish theme indicator with slide-in animation -->
  {#if showThemeIndicator}
    <div
      class="absolute right-14 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-2 bg-glass-light border border-glass rounded-lg shadow-lg backdrop-blur-md transition-all duration-300 ease-out animate-pulse overflow-hidden"
      style="animation: slideInFromRight 0.3s ease-out forwards, fadeOut 0.5s ease-in 1.5s forwards;"
    >
      <div class="relative w-3 h-3 overflow-hidden">
        <span class="block absolute {getIndicatorTopOffset()} transition-[top] duration-250">
          <!-- Light theme icon -->
          <span class="flex w-3 h-3 items-center justify-center">
            <FontAwesomeIcon icon={faSun} class="w-3 h-3" />
          </span>
          
          <!-- Dark theme icon -->
          <span class="flex w-3 h-3 items-center justify-center">
            <FontAwesomeIcon icon={faMoon} class="w-3 h-3" />
          </span>
          
          <!-- Auto theme icon -->
          <span class="flex w-3 h-3 items-center justify-center">
            <FontAwesomeIcon icon={faCircleHalfStroke} class="w-3 h-3" />
          </span>
        </span>
      </div>
      <span class="text-sm font-medium whitespace-nowrap">{getThemeDisplayName()}</span>
    </div>
  {/if}

  <!-- Theme switcher button -->
  <button
    class="relative block w-10 h-10 rounded border bg-glass-light border-glass cursor-pointer shadow transition-all duration-200 focus:outline-none overflow-hidden hover:scale-105 active:scale-95"
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
