<script lang="ts">
	import type { PageData } from './$types';
	import Card from '../../../../../components/Card.svelte';
	import ProjectSourcesPanel from '../../../../components/ProjectSourcesPanel.svelte';

	let { data }: { data: PageData } = $props();
</script>

<Card padding="lg">
	<ProjectSourcesPanel
		profileId={data.profileId}
		sideProjectId={data.project.id}
		repoUrl={data.project.repo_url}
		documents={data.documents}
	/>
</Card>
