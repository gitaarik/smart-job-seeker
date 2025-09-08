<script lang="ts">
  import type { LayoutData } from "./$types";
  let { data }: { data: LayoutData } = $props();
</script>

<p>
  hi {data.pater}
</p>
