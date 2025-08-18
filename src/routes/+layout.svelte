<script lang="ts">
  import "../app.css";
  import { theme, initializeTheme } from "$lib/stores/theme";
  import type { LayoutData } from './$types';

  let { children, data }: { children: any; data: LayoutData } = $props();
  
  // Initialize theme store with server-detected theme data
  if (data.themePreference && data.actualTheme && data.systemTheme) {
    initializeTheme(data.themePreference, data.actualTheme, data.systemTheme);
  }
</script>

{@render children()}
