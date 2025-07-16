<script lang="ts">
  import { theme, switchTheme } from "$lib/stores/theme";
	import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faSun, faMoon } from "@fortawesome/free-regular-svg-icons";

  function handleToggleTheme() {
    switchTheme();
  }
</script>

<button
  class="block w-10 h-10 fixed top-4 right-4 z-50 rounded border bg-[var(--white-transparent-1)] border-[var(--white-transparent-2)] cursor-pointer shadow transition focus:outline-none"
  aria-label="Toggle light/dark mode"
  on:click={handleToggleTheme}
>
  {#if $theme === "dark"}
    <FontAwesomeIcon icon={faMoon} />
  {:else}
    <FontAwesomeIcon icon={faSun} />
  {/if}
</button>
