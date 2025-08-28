<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  let isLogin = true
  let email = ''
  let password = ''
  let firstName = ''
  let lastName = ''
  let loading = false
  let error = ''
  let message = ''

  let showForgotPassword = false

  async function handleAuth() {
    if (!email || !password) {
      error = 'Email and password are required'
      return
    }

    loading = true
    error = ''

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register'
      const body = isLogin
        ? { email, password }
        : { email, password, firstName, lastName }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        goto('/')
      } else {
        error = data.error || 'Authentication failed'
      }
    } catch (err) {
      error = 'Network error. Please try again.'
    } finally {
      loading = false
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      error = 'Email is required'
      return
    }

    loading = true
    error = ''
    message = ''

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (data.success) {
        message = data.message
        showForgotPassword = false
      } else {
        error = data.error
      }
    } catch (err) {
      error = 'Network error. Please try again.'
    } finally {
      loading = false
    }
  }

  function toggleMode() {
    isLogin = !isLogin
    error = ''
    message = ''
    showForgotPassword = false
  }

  function toggleForgotPassword() {
    showForgotPassword = !showForgotPassword
    error = ''
    message = ''
  }
</script>

<svelte:head>
  <title>{isLogin ? 'Login' : 'Sign Up'} - Portfolio</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
        {#if showForgotPassword}
          Reset your password
        {:else if isLogin}
          Sign in to your account
        {:else}
          Create your account
        {/if}
      </h2>
    </div>

    <div class="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
      {#if error}
        <div class="mb-4 p-3 text-sm text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/50 rounded-lg">
          {error}
        </div>
      {/if}

      {#if message}
        <div class="mb-4 p-3 text-sm text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/50 rounded-lg">
          {message}
        </div>
      {/if}

      {#if showForgotPassword}
        <form on:submit|preventDefault={handleForgotPassword} class="space-y-6">
          <div>
            <label for="forgot-email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email address
            </label>
            <input
              id="forgot-email"
              type="email"
              bind:value={email}
              required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter your email address"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>

          <div class="text-center">
            <button
              type="button"
              on:click={toggleForgotPassword}
              class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500"
            >
              Back to login
            </button>
          </div>
        </form>
      {:else}
        <form on:submit|preventDefault={handleAuth} class="space-y-6">
          {#if !isLogin}
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="firstName" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  bind:value={firstName}
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label for="lastName" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  bind:value={lastName}
                  class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          {/if}

          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email address
            </label>
            <input
              id="email"
              type="email"
              bind:value={email}
              required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              bind:value={password}
              required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {#if isLogin}
            <div class="text-right">
              <button
                type="button"
                on:click={toggleForgotPassword}
                class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500"
              >
                Forgot your password?
              </button>
            </div>
          {/if}

          <div>
            <button
              type="submit"
              disabled={loading}
              class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : isLogin ? 'Sign in' : 'Sign up'}
            </button>
          </div>

          <div class="text-center">
            <button
              type="button"
              on:click={toggleMode}
              class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>
</div>