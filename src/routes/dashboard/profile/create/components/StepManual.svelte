<script lang="ts">
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faSpinner } from "@fortawesome/free-solid-svg-icons";

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

<div class="space-y-6">
  <div class="text-center">
    <h2 class="text-xl font-semibold text-slate mb-2">Create Your Profile</h2>
    <p class="text-pearl">Enter your basic information to get started</p>
  </div>

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
      <div class="rounded-md bg-red-50 p-4">
        <p class="text-sm text-crimson">{error}</p>
      </div>
    {/if}

    <div>
      <label for="name" class="block text-sm font-medium text-slate mb-1">
        Full Name <span class="text-crimson">*</span>
      </label>
      <input
        id="name"
        name="name"
        type="text"
        bind:value={name}
        required
        class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
        placeholder="John Doe"
      />
    </div>

    <div>
      <label for="title" class="block text-sm font-medium text-slate mb-1">
        Professional Title
      </label>
      <input
        id="title"
        name="title"
        type="text"
        bind:value={title}
        class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
        placeholder="Software Engineer"
      />
      <p class="text-xs text-pearl mt-1">
        This will appear below your name on your profile.
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <div>
        <label for="email" class="block text-sm font-medium text-slate mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          bind:value={email}
          class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
          placeholder="john@example.com"
        />
      </div>

      <div>
        <label for="phone" class="block text-sm font-medium text-slate mb-1">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          bind:value={phone}
          class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
          placeholder="+1 (555) 123-4567"
        />
      </div>
    </div>

    <div class="flex gap-3 pt-4">
      <button
        type="button"
        onclick={onBack}
        class="flex-1 py-2 px-4 border border-light rounded-lg text-slate hover:bg-light/50 transition-colors"
      >
        Back
      </button>

      <button
        type="submit"
        disabled={!name.trim() || isLoading}
        class="flex-1 py-2 px-4 bg-ocean text-pearl font-medium rounded-lg hover:bg-aqua transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {#if isLoading}
          <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
          Creating...
        {:else}
          Create Profile
        {/if}
      </button>
    </div>
  </form>
</div>
