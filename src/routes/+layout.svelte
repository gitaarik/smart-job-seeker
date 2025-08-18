<script lang="ts">
  import "../app.css";
  import { theme } from "$lib/stores/theme";
  import type { LayoutData } from './$types';

  let { children, data }: { children: any; data: LayoutData } = $props();
  
  // Initialize theme store with server-detected theme
  if (data.serverTheme) {
    theme.set(data.serverTheme);
  }
</script>

{@render children()}
