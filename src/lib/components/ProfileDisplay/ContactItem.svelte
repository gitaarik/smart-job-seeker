<script lang="ts">
  export let label: string;
  export let href: string | null = null;
  export let content: string | null = null;
  export let type: "link" | "email" | "phone" = "link";
</script>

<span
  class="inline-block font-bold whitespace-nowrap mr-[1px]"
>
  <span class="inline-block w-0 opacity-0">-&nbsp;</span>{label}:
</span>

{#if href || content}
  {#if type === "email"}
    <a href="mailto:{href}" class="underline hover:text-slate-600">{content}</a>
  {:else if type === "phone"}
    <a href="tel:{href}" class="underline hover:text-slate-600">{content}</a>
  {:else}
    <a {href} target="_blank" class="underline hover:text-slate-600">{
      content
    }</a>
  {/if}
{/if}

<slot />
