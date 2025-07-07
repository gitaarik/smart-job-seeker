<script lang="ts">
  export let headerText: string = "";

  let classNames: string = "";
  export { classNames as class };
</script>

<div
  class="bg-gray-100 rounded-lg {classNames} border-2 border-[var(--primary-color)] overflow-hidden sm:min-w-[320px]"
>
  <h3
    class="font-medium px-4 py-2 bg-[var(--primary-color)] text-[var(--text-light-color)]"
  >
    {headerText}
  </h3>

  <slot />
</div>
