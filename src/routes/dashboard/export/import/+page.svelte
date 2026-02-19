<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faFileImport } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
</script>

<div class="space-y-6">
  <SectionHeader title="Import Data" icon={faFileImport} />

  <div
    class="flex flex-col items-center justify-center py-12 px-6 border-2 border-dashed border-[var(--dash-border)] rounded-lg"
  >
    <div
      class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4"
    >
      <FontAwesomeIcon
        icon={faFileImport}
        class="w-8 h-8 text-[var(--dash-text-muted)]"
      />
    </div>
    <h3 class="text-lg font-medium text-[var(--dash-text)] mb-2">
      Import functionality coming soon
    </h3>
    <p class="text-[var(--dash-text-secondary)] text-center max-w-sm">
      You'll be able to import profile data from JSON exports to restore
      backups or migrate your information.
    </p>
  </div>
</div>
