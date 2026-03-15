<script lang="ts">
  import { authClient } from "$lib/auth-client";

  let email = $state("");
  let error = $state("");
  let success = $state(false);
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = "";
    loading = true;

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });

      if (result.error) {
        error = result.error.message || "Failed to send reset email";
        return;
      }

      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : "An error occurred";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Forgot Password - Smart Job Seeker</title>
</svelte:head>

<div
  class="min-h-screen flex items-center justify-center bg-[var(--dash-bg)] py-12 px-4 sm:px-6 lg:px-8 transition-colors"
>
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2
        class="mt-6 text-center text-3xl font-extrabold text-[var(--dash-text)]"
      >
        Reset your password
      </h2>
      <p class="mt-2 text-center text-sm text-[var(--dash-text-secondary)]">
        Enter your email and we'll send you a link to reset your password.
      </p>
    </div>

    {#if success}
      <div class="rounded-md bg-green-50 dark:bg-green-900/20 p-4">
        <p class="text-sm text-green-700 dark:text-green-400">
          If an account exists with that email, we've sent you a password reset
          link. Check your inbox.
        </p>
      </div>
      <div class="text-center">
        <a
          href="/login"
          class="font-medium text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
        >
          Back to sign in
        </a>
      </div>
    {:else}
      <form class="mt-8 space-y-6" onsubmit={handleSubmit}>
        {#if error}
          <div class="rounded-md bg-red-50 p-4">
            <p class="text-sm text-red-700">{error}</p>
          </div>
        {/if}

        <div>
          <label for="email" class="sr-only">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autocomplete="email"
            bind:value={email}
            required
            class="appearance-none rounded-md relative block w-full px-3 py-2 border border-[var(--dash-border)] placeholder-[var(--dash-text-muted)] text-[var(--dash-text)] bg-[var(--dash-card)] focus:outline-none focus:ring-[var(--dash-primary)] focus:border-[var(--dash-primary)] focus:z-10 sm:text-sm transition-colors"
            placeholder="Email address"
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[var(--dash-primary)] hover:bg-[var(--dash-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--dash-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {#if loading}
              Sending...
            {:else}
              Send reset link
            {/if}
          </button>
        </div>

        <div class="text-center">
          <a
            href="/login"
            class="font-medium text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
          >
            Back to sign in
          </a>
        </div>
      </form>
    {/if}
  </div>
</div>
