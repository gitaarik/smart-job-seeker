<script lang="ts">
  import SectionHeader from "./SectionHeader.svelte";

  export let title;
  export let icon;

  let classNames = "";
  export { classNames as class };
</script>

<article
  class="bg-frost print:bg-transparent border-[1.2px] border-ocean rounded-xl p-6 break-inside-avoid print:border-0 print:p-0 {classNames}"
>
  <SectionHeader {title} {icon} />

  <slot />
</article>
