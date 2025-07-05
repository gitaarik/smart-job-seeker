<script lang="ts">
  import ProfileSection from "./ProfileSection.svelte";
  import SummarySection from "./SummarySection.svelte";
  import KeyQualificationsSection from "./KeyQualificationsSection.svelte";

  export let profile;
</script>

<div class="space-y-10 print:space-y-7">
  <ProfileSection profile={profile} />
  <SummarySection profile={profile} />
  <KeyQualificationsSection profile={profile} />
</div>
