<script lang="ts">
  import Card from "../components/Card.svelte";
  import Checkbox from "../components/Checkbox.svelte";
  import RadioGroup from "../components/RadioGroup.svelte";
  import ToggleSwitch from "../components/ToggleSwitch.svelte";
  import FilterTabs from "../components/FilterTabs.svelte";
  import {
    faEnvelope,
    faLayerGroup,
    faQuestionCircle,
  } from "@fortawesome/free-solid-svg-icons";

  // Checkbox demo
  let checkboxA = $state(true);
  let checkboxB = $state(false);
  let checkboxC = $state(true);

  // RadioGroup demo
  let radioValue = $state("hybrid");
  const radioOptions = [
    { value: "remote", label: "Remote" },
    { value: "hybrid", label: "Hybrid" },
    { value: "onsite", label: "On-site" },
  ];

  // ToggleSwitch demo
  let toggleBasic = $state(false);
  let toggleWithLabel = $state(true);
  let toggleDisabled = $state(false);

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

  <!-- Checkbox -->
  <Card padding="md">
    <h2 class="text-base font-semibold text-[var(--dash-text)] mb-1">Checkbox</h2>
    <p class="text-xs text-[var(--dash-text-secondary)] mb-4">
      Standard checkbox with label. Use for multi-select options and toggleable settings. Value is bindable.
    </p>

    <div class="space-y-5">
      <div>
        <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Inline group</p>
        <div class="flex flex-wrap gap-x-4 gap-y-2">
          <Checkbox bind:checked={checkboxA} label="Remote" />
          <Checkbox bind:checked={checkboxB} label="Hybrid" />
          <Checkbox bind:checked={checkboxC} label="On-site" />
        </div>
        <p class="text-xs text-[var(--dash-text-muted)] mt-2">Selected: {[checkboxA && "Remote", checkboxB && "Hybrid", checkboxC && "On-site"].filter(Boolean).join(", ") || "none"}</p>
      </div>

      <div>
        <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Usage</p>
        <pre class="text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md p-3 overflow-x-auto"><code>{`<Checkbox bind:checked={value} label="Option" />`}</code></pre>
      </div>
    </div>
  </Card>

  <!-- RadioGroup -->
  <Card padding="md">
    <h2 class="text-base font-semibold text-[var(--dash-text)] mb-1">RadioGroup</h2>
    <p class="text-xs text-[var(--dash-text-secondary)] mb-4">
      Single-select radio buttons. Use for mutually exclusive choices. Value is bindable.
    </p>

    <div class="space-y-5">
      <div>
        <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Default</p>
        <RadioGroup options={radioOptions} bind:value={radioValue} />
        <p class="text-xs text-[var(--dash-text-muted)] mt-2">Selected: {radioValue}</p>
      </div>

      <div>
        <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Usage</p>
        <pre class="text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md p-3 overflow-x-auto"><code>{`<RadioGroup
  options={[
    { value: "remote", label: "Remote" },
    { value: "hybrid", label: "Hybrid" },
    { value: "onsite", label: "On-site" },
  ]}
  bind:value={selected}
/>`}</code></pre>
      </div>
    </div>
  </Card>

  <!-- ToggleSwitch -->
  <Card padding="md">
    <h2 class="text-base font-semibold text-[var(--dash-text)] mb-1">ToggleSwitch</h2>
    <p class="text-xs text-[var(--dash-text-secondary)] mb-4">
      On/off toggle. Supports label, description, and disabled state. Value is bindable.
    </p>

    <div class="space-y-5">
      <div>
        <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Basic</p>
        <ToggleSwitch bind:checked={toggleBasic} />
        <p class="text-xs text-[var(--dash-text-muted)] mt-2">Checked: {toggleBasic}</p>
      </div>

      <div>
        <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">With label and description</p>
        <ToggleSwitch
          bind:checked={toggleWithLabel}
          label="Enable feature"
          description="This enables an optional feature that does something useful"
        />
      </div>

      <div>
        <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Disabled</p>
        <ToggleSwitch bind:checked={toggleDisabled} label="Unavailable option" disabled />
      </div>

      <div>
        <p class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Usage</p>
        <pre class="text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md p-3 overflow-x-auto"><code>{`<ToggleSwitch
  bind:checked={enabled}
  label="Enable feature"
  description="Optional description text"
/>`}</code></pre>
      </div>
    </div>
  </Card>

  <!-- FilterTabs -->
  <Card padding="md">
    <h2 class="text-base font-semibold text-[var(--dash-text)] mb-1">FilterTabs</h2>
    <p class="text-xs text-[var(--dash-text-secondary)] mb-4">
      Single-select tabs for filtering or choosing between options. Icons are optional.
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
