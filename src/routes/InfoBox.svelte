<script lang="ts">
  export let headerText: string = "";

  let classNames: string = "";
  export { classNames as class };
</script>

<div
  class="bg-[#e8edf0] rounded-lg {classNames} border-2 border-[var(--primary-color)] overflow-hidden min-w-[250px]"
>
  <h3
    class="font-medium px-4 py-2 bg-[var(--primary-color)] text-white"
  >
    {headerText}
  </h3>

  <slot />
</div>
