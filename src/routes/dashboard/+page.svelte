<script lang="ts">
  import { goto } from '$app/navigation'
  import type { PageData } from './$types'

  export let data: PageData

  async function logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST'
      })
      goto('/auth')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }
</script>

<svelte:head>
  <title>Dashboard - Portfolio</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
  <nav class="bg-white dark:bg-gray-800 shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <h1 class="text-xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
        </div>
        <div class="flex items-center space-x-4">
          <span class="text-sm text-gray-700 dark:text-gray-300">
            Welcome, {data.user.firstName || data.user.email}!
          </span>
          <button
            on:click={logout}
            class="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-md transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  </nav>

  <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <div class="px-4 py-6 sm:px-0">
      <!-- Admin Panel Link -->
      {#if data.user.role === 'ADMIN' || data.user.role === 'SUPER_ADMIN'}
        <div class="mb-6">
          <a
            href="/admin"
            class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"></path>
            </svg>
            Admin Panel
          </a>
        </div>
      {/if}

      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-5 sm:p-6">
          <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
            Your Profile
          </h3>
          
          <dl class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">{data.user.email}</dd>
            </div>
            
            {#if data.user.firstName}
              <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">First Name</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white">{data.user.firstName}</dd>
              </div>
            {/if}
            
            {#if data.user.lastName}
              <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last Name</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white">{data.user.lastName}</dd>
              </div>
            {/if}
            
            <div>
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">User ID</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white font-mono">{data.user.id}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </main>
</div>