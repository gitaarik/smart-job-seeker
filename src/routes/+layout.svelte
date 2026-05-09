<script lang="ts">
  import { config } from "@fortawesome/fontawesome-svg-core";
  config.autoAddCss = false;

  import "../app.css";
  import "./(app)/dashboard.css";
  import { onMount } from "svelte";
  import { initializeTheme } from "$lib/stores/theme.svelte";
  import { identify } from "$lib/tools/analytics";
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

  // Inject Umami analytics script if configured
  onMount(() => {
    if (data.umamiUrl && data.umamiWebsiteId) {
      const script = document.createElement("script");
      script.defer = true;
      script.src = `${data.umamiUrl}/script.js`;
      script.dataset.websiteId = data.umamiWebsiteId;
      script.onload = () => {
        if (data.user) {
          identify({ id: data.user.id });
        }
      };
      document.head.appendChild(script);
    }
  });
</script>

{@render children()}
