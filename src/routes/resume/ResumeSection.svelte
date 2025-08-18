<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";

  export let title;
  export let icon;

  let classNames = "";
  export { classNames as class };
</script>

<article
  class="bg-frost print:bg-white border-[1.2px] border-ocean rounded-xl p-6 break-inside-avoid print:border-0 print:p-0 {classNames}"
>
  <h2
    class="relative border-b-2 border-ocean pb-1 mb-5"
  >
    <span class="text-xl font-semibold pr-12 print:text-lg">{title}</span>
    <div class="absolute right-1 top-1">
      <FontAwesomeIcon {icon} size="lg" />
    </div>
  </h2>

  <slot />
</article>
