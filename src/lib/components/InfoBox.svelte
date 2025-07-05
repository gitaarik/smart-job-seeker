<script lang="ts">
  export let headerText: string = "";

  let classNames: string = "";
  export { classNames as class };
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
