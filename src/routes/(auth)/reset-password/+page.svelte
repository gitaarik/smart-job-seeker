<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let password = $state("");
  let confirmPassword = $state("");
  let error = $state("");
  let success = $state(false);
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = "";

    if (password !== confirmPassword) {
      error = "Passwords do not match";
      return;
    }

    if (!data.token) {
      error = "Invalid or missing reset token";
      return;
    }

    loading = true;

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token: data.token,
      });

      if (result.error) {
        error = result.error.message || "Failed to reset password";
        return;
      }

      success = true;
      // Redirect to login after a short delay
      setTimeout(() => goto("/login"), 2000);
    } catch (err) {
      error = err instanceof Error ? err.message : "An error occurred";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Reset Password - Smart Job Seeker</title>
</svelte:head>

<div
  class="min-h-screen flex items-center justify-center bg-[var(--dash-bg)] py-12 px-4 sm:px-6 lg:px-8 transition-colors"
>
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2
        class="mt-6 text-center text-3xl font-extrabold text-[var(--dash-text)]"
      >
        Set new password
      </h2>
      <p class="mt-2 text-center text-sm text-[var(--dash-text-secondary)]">
        Enter your new password below.
      </p>
    </div>

    {#if !data.token}
      <div class="rounded-md bg-red-50 p-4">
        <p class="text-sm text-red-700">
          Invalid or missing reset token. Please request a new password reset
          link.
        </p>
      </div>
      <div class="text-center">
        <a
          href="/forgot-password"
          class="font-medium text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
        >
          Request new reset link
        </a>
      </div>
    {:else if success}
      <div class="rounded-md bg-green-50 dark:bg-green-900/20 p-4">
        <p class="text-sm text-green-700 dark:text-green-400">
          Your password has been reset successfully. Redirecting to sign in...
        </p>
      </div>
    {:else}
      <form class="mt-8 space-y-6" onsubmit={handleSubmit}>
        {#if error}
          <div class="rounded-md bg-red-50 p-4">
            <p class="text-sm text-red-700">{error}</p>
          </div>
        {/if}

        <div class="rounded-md shadow-sm -space-y-px">
          <div>
            <label for="password" class="sr-only">New password</label>
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="new-password"
              bind:value={password}
              required
              minlength="8"
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-[var(--dash-border)] placeholder-[var(--dash-text-muted)] text-[var(--dash-text)] bg-[var(--dash-card)] rounded-t-md focus:outline-none focus:ring-[var(--dash-primary)] focus:border-[var(--dash-primary)] focus:z-10 sm:text-sm transition-colors"
              placeholder="New password (min 8 characters)"
            />
          </div>
          <div>
            <label for="confirmPassword" class="sr-only"
            >Confirm new password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autocomplete="new-password"
              bind:value={confirmPassword}
              required
              minlength="8"
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-[var(--dash-border)] placeholder-[var(--dash-text-muted)] text-[var(--dash-text)] bg-[var(--dash-card)] rounded-b-md focus:outline-none focus:ring-[var(--dash-primary)] focus:border-[var(--dash-primary)] focus:z-10 sm:text-sm transition-colors"
              placeholder="Confirm new password"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[var(--dash-primary)] hover:bg-[var(--dash-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--dash-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {#if loading}
              Resetting...
            {:else}
              Reset password
            {/if}
          </button>
        </div>
      </form>
    {/if}
  </div>
</div>
