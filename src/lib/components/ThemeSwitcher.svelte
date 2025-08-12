<script lang="ts">
  import { switchTheme, theme } from "$lib/stores/theme";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faMoon, faSun } from "@fortawesome/free-regular-svg-icons";
  import { track } from "$lib/tools/analytics";

  function handleToggleTheme() {
    switchTheme();
    track("SwitchTheme");
  }

  function getTopOffset() {
    if ($theme === "dark") {
      return "-top-10";
    } else {
      return "top-0";
    }
  }
</script>

<button
  class="block w-10 h-10 fixed top-4 right-4 z-50 rounded border bg-[var(--white-transparent-1)] border-[var(--white-transparent-2)] cursor-pointer shadow transition focus:outline-none overflow-hidden"
  aria-label="Toggle light/dark mode"
  on:click={handleToggleTheme}
>
  <span
    class="block absolute {getTopOffset()} transition-[top] duration-250"
  >
    <span class="flex w-10 h-10 items-center justify-center">
      <FontAwesomeIcon icon={faSun} class="w-4" />
    </span>

    <span class="flex w-10 h-10 items-center justify-center">
      <FontAwesomeIcon icon={faMoon} class="w-4" />
    </span>
  </span>
</button>
