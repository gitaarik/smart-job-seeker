<script lang="ts">
  import { enhance } from "$app/forms";
  import Spinner from "$lib/components/Spinner.svelte";
  import Card from "../../../components/Card.svelte";

  interface Props {
    isLoading: boolean;
    error: string | null;
    onBack: () => void;
    onLoadingChange: (loading: boolean) => void;
  }

  let { isLoading, error, onBack, onLoadingChange }: Props = $props();

  let name = $state("");
  let title = $state("");
  let email = $state("");
  let phone = $state("");
</script>

<Card padding="responsive">
  <h3 class="font-medium text-[var(--dash-text)] mb-1">
    Create Your Profile
  </h3>
  <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
    Enter your basic information to get started
  </p>

  <form
    method="POST"
    action="?/manual"
    use:enhance={() => {
      onLoadingChange(true);
      return async ({ update }) => {
        onLoadingChange(false);
        await update();
      };
    }}
    class="space-y-4"
  >
    {#if error}
      <div
        class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
      >
        <p class="text-sm text-[var(--dash-error)]">{error}</p>
      </div>
    {/if}

    <div>
      <label
        for="name"
        class="block text-sm font-medium text-[var(--dash-text)] mb-1"
      >
        Full Name <span class="text-[var(--dash-error)]">*</span>
      </label>
      <input
        id="name"
        name="name"
        type="text"
        bind:value={name}
        required
        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
        placeholder="John Doe"
      />
    </div>

    <div>
      <label
        for="title"
        class="block text-sm font-medium text-[var(--dash-text)] mb-1"
      >
        Professional Title
      </label>
      <input
        id="title"
        name="title"
        type="text"
        bind:value={title}
        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
        placeholder="Software Engineer"
      />
      <p class="text-xs text-[var(--dash-text-muted)] mt-1">
        This will appear below your name on your profile.
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <div>
        <label
          for="email"
          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          bind:value={email}
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          placeholder="john@example.com"
        />
      </div>

      <div>
        <label
          for="phone"
          class="block text-sm font-medium text-[var(--dash-text)] mb-1"
        >
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          bind:value={phone}
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          placeholder="+1 (555) 123-4567"
        />
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onclick={onBack}
        class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
      >
        Back
      </button>

      <button
        type="submit"
        disabled={!name.trim() || isLoading}
        class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {#if isLoading}
          <Spinner size="w-4 h-4" />
          Creating...
        {:else}
          Create Profile
        {/if}
      </button>
    </div>
  </form>
</Card>
