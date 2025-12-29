<script lang="ts">
  interface Props {
    label: string;
    href?: string | null;
    content?: string | null;
    type?: "link" | "email" | "phone";
  }

  let { label, href = null, content = null, type = "link" }: Props =
    $props();
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
