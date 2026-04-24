<script lang="ts">
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";

  let { children } = $props();
</script>

<div class="fixed top-0 right-0 z-50 p-4">
  <ThemeSwitcher />
</div>

{@render children()}
