<script lang="ts">
	import type { PageData } from './$types';
	import Card from '../../../../../../../components/Card.svelte';
	import ProjectStoriesPanel from '../../../../../../components/ProjectStoriesPanel.svelte';

	let { data }: { data: PageData } = $props();
</script>

<Card padding="lg">
	<ProjectStoriesPanel
		profileId={data.profileId}
		kind="work_experience_project"
		projectId={data.project.id}
		projectName={data.project.name ?? ''}
		stories={data.stories}
		candidates={data.candidates}
	/>
</Card>
