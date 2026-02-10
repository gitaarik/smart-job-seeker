<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faArrowLeft, faUser } from "@fortawesome/free-solid-svg-icons";

  let { form }: { form: ActionData } = $props();

  let name = $state(form?.name || "");
  let title = $state(form?.title || "");
  let loading = $state(false);
</script>

<svelte:head>
  <title>Create Profile - Smart Job Seeker</title>
</svelte:head>

<div class="max-w-lg mx-auto">
  <a
    href="/dashboard"
    class="inline-flex items-center gap-2 text-pearl hover:text-slate transition-colors mb-6"
  >
    <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
    <span>Back to Dashboard</span>
  </a>

  <div class="bg-snow rounded-lg border border-light p-8">
    <div class="flex items-center gap-4 mb-6">
      <div
        class="w-12 h-12 rounded-full bg-ocean flex items-center justify-center"
      >
        <FontAwesomeIcon icon={faUser} class="w-6 h-6 text-pearl" />
      </div>
      <div>
        <h1 class="text-2xl font-semibold text-slate">Create Your Profile</h1>
        <p class="text-pearl">
          Set up your professional profile to get started.
        </p>
      </div>
    </div>

    <form
      method="POST"
      use:enhance={() => {
        loading = true;
        return async ({ update }) => {
          loading = false;
          await update();
        };
      }}
      class="space-y-6"
    >
      {#if form?.error}
        <div class="rounded-md bg-red-50 p-4">
          <p class="text-sm text-crimson">{form.error}</p>
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

      <button
        type="submit"
        disabled={loading || !name.trim()}
        class="w-full py-2 px-4 bg-ocean text-pearl font-medium rounded-lg hover:bg-aqua transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {#if loading}
          Creating...
        {:else}
          Create Profile
        {/if}
      </button>
    </form>
  </div>
</div>
