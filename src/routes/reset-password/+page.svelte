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

<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Set new password
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Enter your new password below.
      </p>
    </div>

    {#if !data.token}
      <div class="rounded-md bg-red-50 p-4">
        <p class="text-sm text-red-700">
          Invalid or missing reset token. Please request a new password reset link.
        </p>
      </div>
      <div class="text-center">
        <a href="/forgot-password" class="font-medium text-indigo-600 hover:text-indigo-500">
          Request new reset link
        </a>
      </div>
    {:else if success}
      <div class="rounded-md bg-green-50 p-4">
        <p class="text-sm text-green-700">
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
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="New password (min 8 characters)"
            />
          </div>
          <div>
            <label for="confirmPassword" class="sr-only">Confirm new password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autocomplete="new-password"
              bind:value={confirmPassword}
              required
              minlength="8"
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Confirm new password"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
