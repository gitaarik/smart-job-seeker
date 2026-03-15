<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faSpinner } from "@fortawesome/free-solid-svg-icons";
  let name = $state("");
  let email = $state("");
  let password = $state("");
  let confirmPassword = $state("");
  let error = $state("");
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = "";

    if (password !== confirmPassword) {
      error = "Passwords do not match";
      return;
    }

    loading = true;

    try {
      const result = await authClient.signUp.email({
        name,
        email,
        password,
      });

      if (result.error) {
        error = result.error.message || "Signup failed";
        return;
      }

      goto("/signup/pending");
    } catch (err) {
      error = err instanceof Error ? err.message : "An error occurred";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Join - Smart Job Seeker</title>
</svelte:head>

<div
  class="min-h-screen flex items-center justify-center bg-[var(--dash-bg)] py-12 px-4 sm:px-6 lg:px-8 transition-colors"
>
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2
        class="mt-6 text-center text-3xl font-extrabold text-[var(--dash-text)]"
      >
        Join Smart Job Seeker
      </h2>
      <p class="mt-2 text-center text-sm text-[var(--dash-text-secondary)]">
        Already have an account?
        <a
          href="/login"
          class="font-medium text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
        >
          Sign in
        </a>
      </p>
    </div>

    <form method="POST" class="mt-8 space-y-6" onsubmit={handleSubmit}>
      {#if error}
        <div class="rounded-md bg-[var(--dash-error-light)] p-4">
          <p class="text-sm text-[var(--dash-error)]">{error}</p>
        </div>
      {/if}

      <div class="space-y-4">
        <div>
          <label
            for="name"
            class="block text-sm font-medium text-[var(--dash-text)]"
          >Name</label>
          <input
            id="name"
            name="name"
            type="text"
            autocomplete="name"
            bind:value={name}
            required
            class="mt-1 block w-full px-3 py-2 border border-[var(--dash-border-input)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-[var(--dash-primary)] focus:border-[var(--dash-primary)] sm:text-sm"
            placeholder="Your name"
          />
        </div>
        <div>
          <label
            for="email"
            class="block text-sm font-medium text-[var(--dash-text)]"
          >Email</label>
          <input
            id="email"
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
            for="password"
            class="block text-sm font-medium text-[var(--dash-text)]"
          >Password</label>
          <input
            id="password"
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
            for="confirm-password"
            class="block text-sm font-medium text-[var(--dash-text)]"
          >Confirm password</label>
          <input
            id="confirm-password"
            name="confirm-password"
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
            Join
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>
