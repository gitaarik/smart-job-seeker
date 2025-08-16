<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";

  export let title;
  export let icon;
</script>

<article
  class="bg-[#fcfcfc] border-[1.2px] border-cyan-700 rounded-xl p-6 mb-8 break-inside-avoid print:border-0 print:p-0 print:mb-2"
>
  <h2
    class="relative border-b-2 border-cyan-700 pb-1 mb-5 print:pb-1 print:mb-4"
  >
    <span class="text-xl font-semibold pr-12 print:text-lg">{title}</span>
    <div class="absolute right-1 top-1">
      <FontAwesomeIcon {icon} size="lg" />
    </div>
  </h2>

  <slot />
</article>
