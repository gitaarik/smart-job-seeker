<script lang="ts">
  import { getFaIcon } from "$lib/tools/fa-icons";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";

  type Item = {
    title: string;
    description: string;
    icon?: any;
  };

  export let items: Array<Item> = [];

  let classNames = "";
  export { classNames as class };
</script>

<div
  class="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-3 print:gap-2 {classNames}"
>
  {#each items as item, index (index)}
    <div
      class="bg-frost border border-aqua rounded-md hover:bg-cloud/30 transition-colors duration-200"
    >
      <h5
        class="text-sm font-semibold mb-1 px-2 py-2 bg-aqua/13 rounded-t-md border-b-1 border-aqua flex items-center"
      >
        {#if item.icon && item.icon.split}
          <FontAwesomeIcon
            icon={getFaIcon(item.icon)}
            class="w-3 h-3 mr-2 flex-shrink-0"
          />
        {/if}
        {item.title}
      </h5>
      <p class="text-sm px-2 pb-2 leading-relaxed">
        {item.description}
      </p>
    </div>
  {/each}
</div>
