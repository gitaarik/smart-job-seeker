<script lang="ts">
  export let headerText: string = "";

  let classNames: string = "";
  export { classNames as class };
</script>

<div
  class="bg-[var(--light-bg-color)] rounded-lg {classNames} border-2 border-[var(--bright-color)] overflow-hidden sm:min-w-[320px] transition-colors"
>
  <h3
    class="font-medium px-4 py-2 bg-[var(--bright-color)] text-[var(--text-light-color)] transition-colors"
  >
    {headerText}
  </h3>

  <slot />
</div>
