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
      const result = await authClient.forgetPassword({
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

<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Reset your password
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Enter your email and we'll send you a link to reset your password.
      </p>
    </div>

    {#if success}
      <div class="rounded-md bg-green-50 p-4">
        <p class="text-sm text-green-700">
          If an account exists with that email, we've sent you a password reset link.
          Check your inbox.
        </p>
      </div>
      <div class="text-center">
        <a href="/login" class="font-medium text-indigo-600 hover:text-indigo-500">
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
            class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            placeholder="Email address"
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if loading}
              Sending...
            {:else}
              Send reset link
            {/if}
          </button>
        </div>

        <div class="text-center">
          <a href="/login" class="font-medium text-indigo-600 hover:text-indigo-500">
            Back to sign in
          </a>
        </div>
      </form>
    {/if}
  </div>
</div>
