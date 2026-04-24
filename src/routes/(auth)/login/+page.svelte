<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";
  import Spinner from "$lib/components/Spinner.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let email = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = "";
    loading = true;

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        error = result.error.message || "Login failed";
        return;
      }

      // Redirect to the intended page or dashboard
      goto(data.redirectTo || "/home");
    } catch (err) {
      error = err instanceof Error ? err.message : "An error occurred";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Sign In - Smart Job Seeker</title>
</svelte:head>

<div
  class="min-h-screen flex items-center justify-center bg-[var(--dash-bg)] py-12 px-4 sm:px-6 lg:px-8 transition-colors"
>
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2
        class="mt-6 text-center text-3xl font-extrabold text-[var(--dash-text)]"
      >
        Sign in to your account
      </h2>
    </div>

    <form method="POST" class="mt-8 space-y-6" onsubmit={handleSubmit}>
      {#if error}
        <div class="rounded-md bg-red-50 p-4">
          <p class="text-sm text-red-700">{error}</p>
        </div>
      {/if}

      <div class="rounded-md shadow-sm -space-y-px">
        <div>
          <label for="email" class="sr-only">Email address</label>
          <input
            id="email"
            type="email"
            autocomplete="email"
            bind:value={email}
            required
            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-[var(--dash-border)] placeholder-[var(--dash-text-muted)] text-[var(--dash-text)] bg-[var(--dash-card)] rounded-t-md focus:outline-none focus:ring-[var(--dash-primary)] focus:border-[var(--dash-primary)] focus:z-10 sm:text-sm transition-colors"
            placeholder="Email address"
          />
        </div>
        <div>
          <label for="password" class="sr-only">Password</label>
          <input
            id="password"
            type="password"
            autocomplete="current-password"
            bind:value={password}
            required
            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-[var(--dash-border)] placeholder-[var(--dash-text-muted)] text-[var(--dash-text)] bg-[var(--dash-card)] rounded-b-md focus:outline-none focus:ring-[var(--dash-primary)] focus:border-[var(--dash-primary)] focus:z-10 sm:text-sm transition-colors"
            placeholder="Password"
          />
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div class="text-sm">
          <a
            href="/forgot-password"
            class="font-medium text-[var(--dash-primary)] hover:opacity-80"
          >
            Forgot your password?
          </a>
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[var(--dash-primary)] hover:bg-[var(--dash-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--dash-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {#if loading}
            <Spinner size="w-4 h-4" class="mr-2" />
            Signing in...
          {:else}
            Sign in
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>
