<script lang="ts">
  interface Props {
    tech: Record<string, string>;
  }

  let { tech }: Props = $props();
</script>

<li
  class="px-2 print:px-[6px] py-1 print:py-[4px] text-sm border border-aqua rounded bg-mist hover:bg-ice"
>
  {tech}
</li>
