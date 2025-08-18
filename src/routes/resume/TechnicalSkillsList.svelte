<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  
  type Skill = {
    title: string;
    details: string;
    icon?: any;
  };

  export let skills: Array<Skill> = [];

  let classNames = "";
  export { classNames as class };
</script>

<div class="grid grid-cols-1 md:grid-cols-2 gap-3 {classNames}">
  {#each skills as skill (skill.title)}
    <div
      class="bg-gray-50 border border-gray-400 rounded-md hover:bg-gray-100 transition-colors duration-200"
    >
      <h5
        class="text-sm font-semibold mb-1 px-2 py-2 bg-gray-900/10 rounded-t-md border-b-1 border-gray-400 flex items-center"
      >
        {#if skill.icon}
          <FontAwesomeIcon icon={skill.icon} class="w-3 h-3 mr-2 flex-shrink-0" />
        {/if}
        {skill.title}
      </h5>
      <p class="text-sm px-2 pb-2">
        {skill.details}
      </p>
    </div>
  {/each}
</div>
