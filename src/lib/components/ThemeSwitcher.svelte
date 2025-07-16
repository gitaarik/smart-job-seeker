<script lang="ts">
  import { theme, switchTheme } from "$lib/stores/theme";

  function handleToggleTheme() {
    switchTheme();
  }
</script>

<button
  class="block w-10 h-10 fixed top-4 right-4 z-50 rounded border bg-[var(--white-transparent-1)] border-[var(--white-transparent-2)] cursor-pointer shadow transition focus:outline-none"
  aria-label="Toggle light/dark mode"
  on:click={handleToggleTheme}
>
  {#if $theme === "dark"}🌙{:else}☀️{/if}
</button> 