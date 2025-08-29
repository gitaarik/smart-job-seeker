<script lang="ts">
  import { enhance } from '$app/forms'
  import { goto } from '$app/navigation'
  import type { PageData, ActionData } from './$types'

  export let data: PageData
  export let form: ActionData

  let showCreateModal = false
  let editingToken: any = null
  let showDeleteConfirm = false
  let tokenToDelete: any = null
  let createTokenExpiresAt = ''

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

  function openCreateModal() {
    showCreateModal = true
  }

  function closeCreateModal() {
    showCreateModal = false
    createTokenExpiresAt = ''
  }

  function openEditModal(token: any) {
    editingToken = { 
      ...token,
      expiresAt: token.expiresAt ? new Date(token.expiresAt).toISOString().split('T')[0] : '',
      maxViews: token.maxViews || ''
    }
  }

  function closeEditModal() {
    editingToken = null
  }

  function confirmDelete(token: any) {
    tokenToDelete = token
    showDeleteConfirm = true
  }

  function closeDeleteConfirm() {
    tokenToDelete = null
    showDeleteConfirm = false
  }

  function formatDate(dateString: string | Date) {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function copyToClipboard(token: string) {
    const url = `${window.location.origin}/resume.pdf?token=${token}`
    navigator.clipboard.writeText(url).then(() => {
      alert('Resume URL copied to clipboard!')
    }).catch(() => {
      alert('Failed to copy URL to clipboard')
    })
  }

  function getStatusBadge(token: any) {
    if (!token.isActive) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    if (token.expiresAt && new Date() > new Date(token.expiresAt)) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    if (token.maxViews && token.viewCount >= token.maxViews) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  }

  function getStatusText(token: any) {
    if (!token.isActive) return 'Disabled'
    if (token.expiresAt && new Date() > new Date(token.expiresAt)) return 'Expired'
    if (token.maxViews && token.viewCount >= token.maxViews) return 'Limit Reached'
    return 'Active'
  }

  function setCurrentDate(target: 'create' | 'edit') {
    const today = new Date()
    const dateString = today.toISOString().split('T')[0]
    
    if (target === 'create') {
      createTokenExpiresAt = dateString
    } else {
      editingToken.expiresAt = dateString
    }
  }

  function adjustDate(amount: number, unit: 'day' | 'week' | 'month', target: 'create' | 'edit') {
    let currentDate: string
    if (target === 'create') {
      currentDate = createTokenExpiresAt || new Date().toISOString().split('T')[0]
    } else {
      currentDate = editingToken.expiresAt || new Date().toISOString().split('T')[0]
    }
    
    let date = new Date(currentDate)
    
    switch (unit) {
      case 'day':
        date.setDate(date.getDate() + amount)
        break
      case 'week':
        date.setDate(date.getDate() + (amount * 7))
        break
      case 'month':
        date.setMonth(date.getMonth() + amount)
        break
    }
    
    const newDateString = date.toISOString().split('T')[0]
    if (target === 'create') {
      createTokenExpiresAt = newDateString
    } else {
      editingToken.expiresAt = newDateString
    }
  }

  // Reusable date button component data
  const dateButtons = [
    { label: '- month', action: () => adjustDate(-1, 'month', 'create'), editAction: () => adjustDate(-1, 'month', 'edit') },
    { label: '- week', action: () => adjustDate(-1, 'week', 'create'), editAction: () => adjustDate(-1, 'week', 'edit') },
    { label: '- day', action: () => adjustDate(-1, 'day', 'create'), editAction: () => adjustDate(-1, 'day', 'edit') },
    { label: 'now', action: () => setCurrentDate('create'), editAction: () => setCurrentDate('edit') },
    { label: '+ day', action: () => adjustDate(1, 'day', 'create'), editAction: () => adjustDate(1, 'day', 'edit') },
    { label: '+ week', action: () => adjustDate(1, 'week', 'create'), editAction: () => adjustDate(1, 'week', 'edit') },
    { label: '+ month', action: () => adjustDate(1, 'month', 'create'), editAction: () => adjustDate(1, 'month', 'edit') }
  ]
</script>

<svelte:head>
  <title>Resume Tokens - Admin Dashboard</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
  <!-- Navigation -->
  <nav class="bg-white dark:bg-gray-800 shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center space-x-4">
          <a href="/admin" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400">
            ← Back to Admin Panel
          </a>
          <h1 class="text-xl font-semibold text-gray-900 dark:text-white">Resume Tokens</h1>
        </div>
        <div class="flex items-center space-x-4">
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {data.currentUser.firstName || data.currentUser.email} ({data.currentUser.role})
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
    <!-- Success/Error Messages -->
    {#if form?.success}
      <div class="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded dark:bg-green-900 dark:border-green-800 dark:text-green-200">
        {form.message}
      </div>
    {/if}

    {#if form?.error}
      <div class="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded dark:bg-red-900 dark:border-red-800 dark:text-red-200">
        Error: {form.error}
      </div>
    {/if}

    <!-- Resume Token Management Section -->
    <div class="bg-white dark:bg-gray-800 shadow rounded-lg">
      <div class="px-4 py-5 sm:p-6">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            Resume Token Management
          </h3>
          <button
            on:click={openCreateModal}
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            Create Token
          </button>
        </div>

        <!-- Tokens Table -->
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Token
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Resume Type
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Views
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Expires
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {#each data.tokens as token}
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex flex-col">
                      <div class="text-sm font-medium text-gray-900 dark:text-white">
                        {token.name}
                      </div>
                      {#if token.description}
                        <div class="text-sm text-gray-500 dark:text-gray-400">{token.description}</div>
                      {/if}
                      <div class="text-xs text-gray-400 font-mono mt-1">
                        {token.token.substring(0, 8)}...
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-sm text-gray-900 dark:text-white">
                      {data.resumeTypes.find(type => type.value === token.resumeType)?.label || token.resumeType}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getStatusBadge(token)}">
                      {getStatusText(token)}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900 dark:text-white">
                      {token.viewCount}{token.maxViews ? `/${token.maxViews}` : ''}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {token.expiresAt ? formatDate(token.expiresAt) : 'Never'}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      on:click={() => copyToClipboard(token.token)}
                      class="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                      title="Copy Resume URL"
                    >
                      Copy URL
                    </button>
                    <button
                      on:click={() => openEditModal(token)}
                      class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Edit
                    </button>
                    {#if token.viewCount > 0}
                      <form method="POST" action="?/resetViews" use:enhance class="inline">
                        <input type="hidden" name="tokenId" value={token.id} />
                        <button
                          type="submit"
                          class="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
                          title="Reset view count"
                        >
                          Reset Views
                        </button>
                      </form>
                    {/if}
                    <button
                      on:click={() => confirmDelete(token)}
                      class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </main>
</div>

<!-- Create Token Modal -->
{#if showCreateModal}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
    <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="p-6">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Create Resume Token</h3>
        <form method="POST" action="?/createToken" use:enhance>
          <div class="space-y-4">
            <div>
              <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g., Client ABC Resume Link"
                class="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description (Optional)</label>
              <input
                type="text"
                name="description"
                placeholder="Additional notes about this token"
                class="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label for="resumeType" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Resume Type</label>
              <select
                name="resumeType"
                required
                class="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                {#each data.resumeTypes as type}
                  <option value={type.value}>{type.label}</option>
                {/each}
              </select>
            </div>
            <div>
              <label for="expiresAt" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Expires At (Optional)</label>
              <div class="mt-1 space-y-2">
                <input
                  type="date"
                  name="expiresAt"
                  bind:value={createTokenExpiresAt}
                  class="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <div class="flex flex-wrap gap-1">
                  {#each dateButtons as button}
                    <button
                      type="button"
                      on:click={button.action}
                      class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                    >
                      {button.label}
                    </button>
                  {/each}
                </div>
              </div>
            </div>
            <div>
              <label for="maxViews" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Max Views (Optional)</label>
              <input
                type="number"
                name="maxViews"
                min="1"
                placeholder="Leave empty for unlimited views"
                class="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          <div class="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              on:click={closeCreateModal}
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              Create Token
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Token Modal -->
{#if editingToken}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
    <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="p-6">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Edit Resume Token</h3>
        <form method="POST" action="?/updateToken" use:enhance>
          <input type="hidden" name="tokenId" value={editingToken.id} />
          <div class="space-y-4">
            <div>
              <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <input
                type="text"
                name="name"
                bind:value={editingToken.name}
                required
                class="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <input
                type="text"
                name="description"
                bind:value={editingToken.description}
                class="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label for="resumeType" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Resume Type</label>
              <select
                name="resumeType"
                bind:value={editingToken.resumeType}
                required
                class="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                {#each data.resumeTypes as type}
                  <option value={type.value}>{type.label}</option>
                {/each}
              </select>
            </div>
            <div>
              <label for="expiresAt" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Expires At</label>
              <div class="mt-1 space-y-2">
                <input
                  type="date"
                  name="expiresAt"
                  bind:value={editingToken.expiresAt}
                  class="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <div class="flex flex-wrap gap-1">
                  {#each dateButtons as button}
                    <button
                      type="button"
                      on:click={button.editAction}
                      class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                    >
                      {button.label}
                    </button>
                  {/each}
                </div>
              </div>
            </div>
            <div>
              <label for="maxViews" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Max Views</label>
              <input
                type="number"
                name="maxViews"
                min="1"
                bind:value={editingToken.maxViews}
                class="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div class="flex items-center">
              <input
                type="checkbox"
                name="isActive"
                id="isActive"
                bind:checked={editingToken.isActive}
                value="true"
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label for="isActive" class="ml-2 block text-sm text-gray-900 dark:text-white">
                Token is active
              </label>
            </div>
          </div>
          <div class="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              on:click={closeEditModal}
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              Update Token
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm && tokenToDelete}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
    <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="p-6">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Confirm Delete</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete the token <strong>{tokenToDelete.name}</strong>? This action cannot be undone and the resume link will no longer work.
        </p>
        <form method="POST" action="?/deleteToken" use:enhance>
          <input type="hidden" name="tokenId" value={tokenToDelete.id} />
          <div class="flex justify-end space-x-3">
            <button
              type="button"
              on:click={closeDeleteConfirm}
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
            >
              Delete Token
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}
