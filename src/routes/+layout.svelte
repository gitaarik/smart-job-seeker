<script lang="ts">
  import { config } from "@fortawesome/fontawesome-svg-core";
  config.autoAddCss = false;

  import "../app.css";
  import { initializeTheme } from "$lib/stores/theme.svelte";
  import type { LayoutData } from "./$types";

  let { children, data }: { children: any; data: LayoutData } = $props();

  // Initialize theme store with server-detected theme data
  if (data.themePreference && data.actualTheme && data.systemTheme) {
    initializeTheme(
      data.themePreference,
      data.actualTheme,
      data.systemTheme,
    );
  }
</script>

{@render children()}
