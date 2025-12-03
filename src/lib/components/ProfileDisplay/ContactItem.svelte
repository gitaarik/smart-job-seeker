<script lang="ts">
  export let label: string;
  export let href: string | null = null;
  export let content: string | null = null;
  export let type: "link" | "email" | "phone" = "link";
</script>

<li class="whitespace-nowrap">
  <span
    class="inline-block w-14 text-right font-bold whitespace-nowrap mr-[1px]"
  >
    <span class="inline-block w-0 opacity-0">- </span>{label}:
  </span>

  {#if href || content}
    {#if type === "email"}
      <a href="mailto:{href}" class="underline hover:text-slate-600">{
        content
      }</a>
    {:else if type === "phone"}
      <a href="tel:{href}" class="underline hover:text-slate-600">{content}</a>
    {:else}
      <a {href} target="_blank" class="underline hover:text-slate-600">{
        content
      }</a>
    {/if}
  {/if}

  <slot />
</li>
