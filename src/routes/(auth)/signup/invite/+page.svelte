<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faSpinner } from "@fortawesome/free-solid-svg-icons";
  let { data, form }: { data: PageData; form: ActionData } = $props();

  let password = $state("");
  let confirmPassword = $state("");
  let loading = $state(false);

  function handleSubmit() {
    return async (
      { result, update }: {
        result: { type: string };
        update: () => Promise<void>;
      },
    ) => {
      await update();
      loading = false;
    };
  }
</script>

<svelte:head>
  <title>Accept Invitation - Smart Job Seeker</title>
</svelte:head>

<div
  class="min-h-screen flex items-center justify-center bg-[var(--dash-bg)] py-12 px-4 sm:px-6 lg:px-8 transition-colors"
>
  <div class="max-w-md w-full space-y-8">
    {#if !data.valid}
      <div class="text-center">
        <h2
          class="mt-6 text-3xl font-extrabold text-[var(--dash-text)]"
        >
          Invalid Invitation
        </h2>
        <p class="mt-4 text-[var(--dash-text-secondary)]">
          {data.error}
        </p>
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
          Set Up Your Account
        </h2>
        <p class="mt-2 text-center text-sm text-[var(--dash-text-secondary)]">
          You've been invited to join Smart Job Seeker. Set a password to
          activate your account.
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
        <input type="hidden" name="token" value={data.token} />

        {#if form?.error}
          <div class="rounded-md bg-[var(--dash-error-light)] p-4">
            <p class="text-sm text-[var(--dash-error)]">{form.error}</p>
          </div>
        {/if}

        <div class="space-y-4">
          <div>
            <label
              for="invite-name"
              class="block text-sm font-medium text-[var(--dash-text)]"
            >Name</label>
            <input
              id="invite-name"
              type="text"
              disabled
              value={data.name}
              class="mt-1 block w-full px-3 py-2 border border-[var(--dash-border-input)] rounded-md bg-[var(--dash-bg)] text-[var(--dash-text-muted)] sm:text-sm cursor-not-allowed"
            />
          </div>
          <div>
            <label
              for="invite-email"
              class="block text-sm font-medium text-[var(--dash-text)]"
            >Email</label>
            <input
              id="invite-email"
              type="email"
              disabled
              value={data.email}
              class="mt-1 block w-full px-3 py-2 border border-[var(--dash-border-input)] rounded-md bg-[var(--dash-bg)] text-[var(--dash-text-muted)] sm:text-sm cursor-not-allowed"
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

        <div>
          <button
            type="submit"
            disabled={loading}
            class="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[var(--dash-primary)] hover:bg-[var(--dash-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--dash-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {#if loading}
              <FontAwesomeIcon
                icon={faSpinner}
                class="w-4 h-4 animate-spin mr-2"
              />
              Creating account...
            {:else}
              Activate Account
            {/if}
          </button>
        </div>
      </form>
    {/if}
  </div>
</div>
