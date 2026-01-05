<script lang="ts">
  import SectionHeader from "../components/SectionHeader.svelte";
  import type { IconProp } from "@fortawesome/fontawesome-svg-core";

  interface Props {
    title: string;
    icon: IconProp;
    class?: string;
  }

  let { title, icon, class: classNames = "" }: Props = $props();
</script>

<article
  class="bg-frost print:bg-transparent border-[1.2px] border-ocean rounded-xl p-6 break-inside-avoid print:border-0 print:p-0 {classNames}"
>
  <SectionHeader {title} {icon} />

  <slot />
</article>
