<script lang="ts">
  import { goto } from '$app/navigation'
  import type { PageData } from './$types'

  export let data: PageData

  let prompt = ''
  let context = ''
  let selectedLLM = 'openai'
  let messages: Array<{ type: 'request' | 'response', content: string, timestamp: Date, prompt?: string, context?: string, llm?: string }> = []
  let isLoading = false
  let error = ''

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

  async function generateContent() {
    if (!prompt.trim() || isLoading) return

    const currentPrompt = prompt.trim()
    const currentContext = context.trim()
    prompt = ''
    context = ''
    error = ''
    isLoading = true

    // Add request to messages
    messages = [...messages, {
      type: 'request',
      content: currentPrompt,
      timestamp: new Date(),
      prompt: currentPrompt,
      context: currentContext,
      llm: selectedLLM
    }]

    try {
      const response = await fetch('/api/resume/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: currentPrompt,
          context: currentContext,
          llm: selectedLLM
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response')
      }

      // Add response to messages
      messages = [...messages, {
        type: 'response',
        content: data.answer,
        timestamp: new Date(),
        llm: selectedLLM
      }]

    } catch (err: any) {
      error = err.message || 'An error occurred'
      console.error('Error generating content:', err)
    } finally {
      isLoading = false
    }
  }

  function handleKeydown(event: KeyboardEvent, field: 'prompt' | 'context') {
    if (event.key === 'Enter' && event.ctrlKey && field === 'prompt') {
      event.preventDefault()
      generateContent()
    }
  }

  function clearChat() {
    messages = []
    error = ''
  }

  function formatTime(timestamp: Date) {
    return timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
    })
  }

  // Predefined templates for common use cases
  const templates = [
    {
      name: "Cover Letter",
      prompt: "Write a professional cover letter for this job posting, highlighting my most relevant experience and skills.",
      contextPlaceholder: "Paste the job description here..."
    },
    {
      name: "LinkedIn Message",
      prompt: "Write a professional LinkedIn connection request or message based on this context.",
      contextPlaceholder: "Paste their LinkedIn profile info or previous conversation..."
    },
    {
      name: "Email Response",
      prompt: "Write a professional email response based on this conversation.",
      contextPlaceholder: "Paste the email thread or context here..."
    },
    {
      name: "Skills Summary",
      prompt: "Write a summary of my experience and expertise in a specific technology or domain.",
      contextPlaceholder: "Specify the technology/domain (e.g., 'Python and Django', 'AI/ML', 'Full-stack development')..."
    },
    {
      name: "Project Description",
      prompt: "Write a detailed description of how I would approach this project based on my experience.",
      contextPlaceholder: "Describe the project requirements..."
    }
  ]

  function useTemplate(template: typeof templates[0]) {
    prompt = template.prompt
    context = template.contextPlaceholder
  }
</script>

<svelte:head>
  <title>Resume AI Assistant - Admin</title>
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
          <h1 class="text-xl font-semibold text-gray-900 dark:text-white">Resume AI Assistant</h1>
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

  <main class="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Templates Sidebar -->
      <div class="lg:col-span-1">
        <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Quick Templates</h3>
          <div class="space-y-2">
            {#each templates as template}
              <button
                on:click={() => useTemplate(template)}
                class="w-full text-left p-3 text-sm rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div class="font-medium text-gray-900 dark:text-white">{template.name}</div>
                <div class="text-gray-500 dark:text-gray-400 text-xs mt-1 line-clamp-2">{template.prompt}</div>
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="lg:col-span-2">
        <div class="bg-white dark:bg-gray-800 shadow rounded-lg">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex justify-between items-center">
              <div>
                <h2 class="text-lg font-medium text-gray-900 dark:text-white">
                  AI Content Generator
                </h2>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Generate professional content using your resume data
                </p>
              </div>
              {#if messages.length > 0}
                <button
                  on:click={clearChat}
                  class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Clear History
                </button>
              {/if}
            </div>
          </div>

          <!-- Input Area -->
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div class="space-y-4">
              <!-- LLM Selector -->
              <div>
                <label for="llm-selector" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  AI Model
                </label>
                <select
                  bind:value={selectedLLM}
                  disabled={isLoading}
                  class="w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                >
                  <option value="openai">OpenAI GPT-4o Mini</option>
                  <option value="gemini">Google Gemini 1.5 Flash</option>
                </select>
              </div>

              <!-- Prompt Input -->
              <div>
                <label for="prompt" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  What do you want to generate?
                </label>
                <textarea
                  bind:value={prompt}
                  on:keydown={(e) => handleKeydown(e, 'prompt')}
                  placeholder="e.g., Write a cover letter for this job, Create a LinkedIn message, Summarize my Python experience..."
                  disabled={isLoading}
                  rows="3"
                  class="w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 disabled:opacity-50"
                ></textarea>
              </div>

              <!-- Context Input -->
              <div>
                <label for="context" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Additional Context (Optional)
                </label>
                <textarea
                  bind:value={context}
                  on:keydown={(e) => handleKeydown(e, 'context')}
                  placeholder="Job description, email thread, LinkedIn profile, company info, project requirements, etc."
                  disabled={isLoading}
                  rows="4"
                  class="w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-400 disabled:opacity-50"
                ></textarea>
              </div>

              <div class="flex justify-between items-center">
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Ctrl+Enter to generate
                </p>
                <button
                  on:click={generateContent}
                  disabled={!prompt.trim() || isLoading}
                  class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {#if isLoading}
                    <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Generating...</span>
                  {:else}
                    <span>Generate Content</span>
                  {/if}
                </button>
              </div>
            </div>
          </div>

          <!-- Error Message -->
          {#if error}
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div class="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded">
                {error}
              </div>
            </div>
          {/if}

          <!-- Generated Content -->
          <div class="px-6 py-4">
            {#if messages.length === 0}
              <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                <svg class="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
                <p class="text-lg font-medium mb-2">Ready to Generate Content</p>
                <p class="text-sm">Choose a template or write your own prompt to get started!</p>
              </div>
            {/if}

            <div class="space-y-6">
              {#each messages as message, index}
                {#if message.type === 'response'}
                  <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                    <div class="flex justify-between items-start mb-4">
                      <div class="flex-1">
                        {#if messages[index - 1]?.prompt}
                          <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            <strong>Request:</strong> {messages[index - 1].prompt}
                          </div>
                        {/if}
                        {#if messages[index - 1]?.context}
                          <div class="text-xs text-gray-500 dark:text-gray-500 mb-3 p-2 bg-gray-100 dark:bg-gray-600 rounded">
                            <strong>Context:</strong> {messages[index - 1].context.slice(0, 100)}...
                          </div>
                        {/if}
                        {#if message.llm}
                          <div class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mb-3">
                            {message.llm === 'openai' ? '🤖 OpenAI' : '✨ Gemini'}
                          </div>
                        {/if}
                      </div>
                      <div class="flex items-center space-x-2 ml-4">
                        <button
                          on:click={() => copyToClipboard(message.content)}
                          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          title="Copy to clipboard"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                          </svg>
                        </button>
                        <span class="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    </div>
                    <div class="prose dark:prose-invert max-w-none">
                      <pre class="whitespace-pre-wrap text-sm text-gray-900 dark:text-white font-sans">{message.content}</pre>
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>