<script lang="ts">
  import Card from "../components/Card.svelte";
  import FilterTabs from "../components/FilterTabs.svelte";
  import {
    faEnvelope,
    faLayerGroup,
    faQuestionCircle,
  } from "@fortawesome/free-solid-svg-icons";

  // FilterTabs demo
  let filterValue = $state("all");
  const filterOptions = [
    { value: "all", label: "All", icon: faLayerGroup },
    { value: "letters", label: "Letters", icon: faEnvelope },
    { value: "questions", label: "Questions", icon: faQuestionCircle },
  ];

  let filterValueNoIcons = $state("active");
  const filterOptionsNoIcons = [
    { value: "active", label: "Active" },
    { value: "archived", label: "Archived" },
  ];
</script>

<div class="space-y-8">
  <div>
    <h1 class="text-xl font-bold text-[var(--dash-text)] mb-1">Styleguide</h1>
    <p class="text-sm text-[var(--dash-text-secondary)]">Reusable dashboard components</p>
  </div>

  <!-- FilterTabs -->
  <Card padding="md">
    <h2 class="text-base font-semibold text-[var(--dash-text)] mb-1">FilterTabs</h2>
    <p class="text-xs text-[var(--dash-text-secondary)] mb-4">
      Toggle filters for lists. Matches the job search filter style. Icons are optional.
    </p>

    <div class="space-y-5">
      <div>
        <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">With icons</p>
        <FilterTabs filters={filterOptions} value={filterValue} onchange={(v) => (filterValue = v)} />
        <p class="text-xs text-[var(--dash-text-muted)] mt-2">Selected: {filterValue}</p>
      </div>

      <div>
        <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Without icons</p>
        <FilterTabs filters={filterOptionsNoIcons} value={filterValueNoIcons} onchange={(v) => (filterValueNoIcons = v)} />
        <p class="text-xs text-[var(--dash-text-muted)] mt-2">Selected: {filterValueNoIcons}</p>
      </div>

      <div>
        <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Usage</p>
        <pre class="text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md p-3 overflow-x-auto"><code>{`<FilterTabs
  filters={[
    { value: "all", label: "All", icon: faLayerGroup },
    { value: "letters", label: "Letters", icon: faEnvelope },
    { value: "questions", label: "Questions", icon: faQuestionCircle },
  ]}
  value={currentType}
  onchange={(v) => (currentType = v)}
/>`}</code></pre>
      </div>
    </div>
  </Card>
</div>
