<script lang="ts">
  interface Props {
    headerText?: string;
    class?: string;
  }

  let { headerText = "", class: classNames = "" }: Props = $props();
</script>

<div
  class="bg-ice rounded-lg {classNames} border-2 border-ocean overflow-hidden transition-colors"
>
  <h3
    class="font-medium px-4 py-2 bg-ocean text-pearl transition-colors"
  >
    {headerText}
  </h3>

  <slot />
</div>
