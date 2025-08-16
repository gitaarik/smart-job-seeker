<script lang="ts">
  import CircleList from "./CircleList.svelte";
  import BulletItem from "./BulletItem.svelte";
  
  export let skills: Array<{ title: string; details: string }>;
  export let className = "";
</script>

<CircleList class={className}>
  {#each skills as skill (skill.title)}
    <BulletItem>
      <span class="inline-flex flex-col">
        <h5 class="font-semibold inline">{skill.title}</h5>
        <span>
          {skill.details}
        </span>
      </span>
    </BulletItem>
  {/each}
</CircleList>