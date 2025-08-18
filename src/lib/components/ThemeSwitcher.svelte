<script lang="ts">
  import { switchTheme, theme, themePreference } from "$lib/stores/theme";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faMoon, faSun, faCircleHalfStroke } from "@fortawesome/free-solid-svg-icons";
  import { track } from "$lib/tools/analytics";

  function handleToggleTheme() {
    switchTheme();
    track("SwitchTheme");
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
</script>

<button
  class="block w-10 h-10 fixed top-4 right-4 z-50 rounded border bg-glass-light border-glass cursor-pointer shadow transition focus:outline-none overflow-hidden"
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
