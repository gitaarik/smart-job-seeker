<script lang="ts">
  import CircleList from "./CircleList.svelte";

  type Skill = {
    title: string;
    details: string;
  };

  export let skills: Array<Skill> = [];

  let classNames = "";
  export { classNames as class };
</script>

<CircleList class={classNames}>
  {#each skills as skill (skill.title)}
    <li>
      <span class="inline-flex flex-col">
        <h5 class="font-semibold inline">{skill.title}</h5>
        <span>
          {skill.details}
        </span>
      </span>
    </li>
  {/each}
</CircleList>

