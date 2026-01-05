<script lang="ts">
  import ProfileSection from "./ProfileSection.svelte";
  import SummarySection from "./SummarySection.svelte";
  import KeyQualificationsSection from "./KeyQualificationsSection.svelte";

  interface Props {
    profile: any;
  }

  let { profile }: Props = $props();
</script>

<div class="space-y-10 print:space-y-7">
  <ProfileSection {profile} />
  <SummarySection {profile} />
  <KeyQualificationsSection {profile} />
</div>
