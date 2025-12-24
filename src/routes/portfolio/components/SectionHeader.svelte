<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import type { IconProp } from "@fortawesome/fontawesome-svg-core";

  interface Props {
    title: string;
    icon: IconProp;
  }

  let { title, icon }: Props = $props();
</script>

<h2 class="relative border-b-2 border-ocean pb-1 mb-5">
  <span class="text-xl font-semibold pr-12 print:text-lg">{title}</span>
  <div class="absolute right-1 top-1">
    <FontAwesomeIcon {icon} size="lg" />
  </div>
</h2>