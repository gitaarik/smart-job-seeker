<script>
  import ResumeSection from './ResumeSection.svelte';
  import BulletList from './BulletList.svelte';
  import BulletItem from './BulletItem.svelte';
  
  const methodologies = [
    'Agile, Scrum, Kanban, Extreme Programming (XP)',
    'AI-accelerated development',
    'Test-driven development (TDD)',
    'Secure by design',
    'User experience design (UXD)',
    'Component-based development',
    'Extensive code reviewing',
    'Writing and maintaining documentation',
    'Pair-programming'
  ];
</script>

<ResumeSection title="Project & Development Methodologies" iconName="chart-icon" iconWidth="33" iconHeight="16">
  <BulletList>
    {#each methodologies as methodology}
      <BulletItem>
        <strong>{methodology}</strong>
      </BulletItem>
    {/each}
  </BulletList>
</ResumeSection>