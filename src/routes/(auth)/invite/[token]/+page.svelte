<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import Spinner from "$lib/components/Spinner.svelte";
  let { data, form }: { data: PageData; form: ActionData } = $props();

  let email = $state("");
  let password = $state("");
  let confirmPassword = $state("");
  let loading = $state(false);

  function handleSubmit() {
    return async (
      { update }: { update: () => Promise<void> },
    ) => {
      await update();
      loading = false;
    };
  }
</script>

<svelte:head>
  <title>Device Invitation - Smart Job Seeker</title>
</svelte:head>

<div
  class="min-h-screen flex items-center justify-center bg-[var(--dash-bg)] py-12 px-4 sm:px-6 lg:px-8 transition-colors"
>
  <div class="max-w-md w-full space-y-8">
    {#if !data.valid}
      <div class="text-center">
        <h2 class="mt-6 text-3xl font-extrabold text-[var(--dash-text)]">
          Invalid Invitation
        </h2>
        <p class="mt-4 text-[var(--dash-text-secondary)]">{data.error}</p>
        <a
          href="/login"
          class="mt-6 inline-block font-medium text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
        >
          Go to login
        </a>
      </div>
    {:else}
      <div>
        <h2
          class="mt-6 text-center text-3xl font-extrabold text-[var(--dash-text)]"
        >
          {data.inviterName} invited you
        </h2>
        <p class="mt-2 text-center text-sm text-[var(--dash-text-secondary)]">
          Use <span class="font-medium text-[var(--dash-text)]">{
            data.deviceName
          }</span> to scrape jobs — no setup required on your end.
        </p>
        <p class="mt-2 text-center text-sm">
          <a
            href="/guide/how-it-works"
            class="text-[var(--dash-primary)] hover:underline"
          >New to Smart Job Seeker? See how it works →</a>
        </p>
      </div>

      <form
        method="POST"
        class="mt-8 space-y-6"
        use:enhance={() => {
          loading = true;
          return handleSubmit();
        }}
      >
        {#if form?.error}
          <div class="rounded-md bg-[var(--dash-error-light)] p-4">
            <p class="text-sm text-[var(--dash-error)]">{form.error}</p>
          </div>
        {/if}

        {#if data.loggedIn}
          <p class="text-center text-sm text-[var(--dash-text-secondary)]">
            Accept to start using this device with your account.
          </p>
        {:else}
          <div class="space-y-4">
            <div>
              <label
                for="invite-email"
                class="block text-sm font-medium text-[var(--dash-text)]"
              >Email</label>
              <input
                id="invite-email"
                name="email"
                type="email"
                autocomplete="email"
                bind:value={email}
                required
                class="mt-1 block w-full px-3 py-2 border border-[var(--dash-border-input)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-[var(--dash-primary)] focus:border-[var(--dash-primary)] sm:text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                for="invite-password"
                class="block text-sm font-medium text-[var(--dash-text)]"
              >Password</label>
              <input
                id="invite-password"
                name="password"
                type="password"
                autocomplete="new-password"
                bind:value={password}
                required
                minlength="8"
                class="mt-1 block w-full px-3 py-2 border border-[var(--dash-border-input)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-[var(--dash-primary)] focus:border-[var(--dash-primary)] sm:text-sm"
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label
                for="invite-confirm-password"
                class="block text-sm font-medium text-[var(--dash-text)]"
              >Confirm password</label>
              <input
                id="invite-confirm-password"
                name="confirm_password"
                type="password"
                autocomplete="new-password"
                bind:value={confirmPassword}
                required
                minlength="8"
                class="mt-1 block w-full px-3 py-2 border border-[var(--dash-border-input)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-[var(--dash-primary)] focus:border-[var(--dash-primary)] sm:text-sm"
                placeholder="Repeat your password"
              />
            </div>
          </div>
        {/if}

        <div>
          <button
            type="submit"
            disabled={loading}
            class="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[var(--dash-primary)] hover:bg-[var(--dash-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--dash-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {#if loading}
              <Spinner size="w-4 h-4" class="mr-2" />
              Accepting...
            {:else if data.loggedIn}
              Accept invitation
            {:else}
              Create account & accept
            {/if}
          </button>
        </div>
      </form>
    {/if}
  </div>
</div>
