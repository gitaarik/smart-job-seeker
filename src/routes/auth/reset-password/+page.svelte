<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  let token = ''
  let password = ''
  let confirmPassword = ''
  let loading = false
  let error = ''
  let success = false

  onMount(() => {
    token = $page.url.searchParams.get('token') || ''
    if (!token) {
      error = 'Invalid reset link'
    }
  })

  async function handleReset() {
    if (!password || !confirmPassword) {
      error = 'Both password fields are required'
      return
    }

    if (password !== confirmPassword) {
      error = 'Passwords do not match'
      return
    }

    if (password.length < 6) {
      error = 'Password must be at least 6 characters'
      return
    }

    loading = true
    error = ''

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, password })
      })

      const data = await response.json()

      if (data.success) {
        success = true
        setTimeout(() => {
          goto('/auth')
        }, 3000)
      } else {
        error = data.error || 'Reset failed'
      }
    } catch (err) {
      error = 'Network error. Please try again.'
    } finally {
      loading = false
    }
  }
</script>

<svelte:head>
  <title>Reset Password - Portfolio</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
        Reset your password
      </h2>
    </div>

    <div class="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
      {#if error}
        <div class="mb-4 p-3 text-sm text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/50 rounded-lg">
          {error}
        </div>
      {/if}

      {#if success}
        <div class="mb-4 p-3 text-sm text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/50 rounded-lg">
          Password reset successful! You will be redirected to the login page in 3 seconds.
        </div>
      {:else if token}
        <form on:submit|preventDefault={handleReset} class="space-y-6">
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              New Password
            </label>
            <input
              id="password"
              type="password"
              bind:value={password}
              required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter new password (min 6 characters)"
            />
          </div>

          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              bind:value={confirmPassword}
              required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Confirm new password"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>

          <div class="text-center">
            <a
              href="/auth"
              class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500"
            >
              Back to login
            </a>
          </div>
        </form>
      {/if}
    </div>
  </div>
</div>