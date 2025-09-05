<script lang="ts">
  import { goto } from '$app/navigation'
  import type { PageData } from './$types'

  export let data: PageData

  let prompt = ''
  let context = ''
  let selectedLLM = typeof localStorage !== 'undefined' ? localStorage.getItem('resume-chat-llm') || 'openai' : 'openai'
  let messages: Array<{ 
    type: 'request' | 'response', 
    content: string, 
    timestamp: Date, 
    prompt?: string, 
    context?: string, 
    llm?: string,
    id?: string,
    parentId?: string,
    dbId?: string, // Database ID for responses
    refinements?: Array<{ content: string, request: string, timestamp: Date }>
  }> = []
  let isLoading = false
  let error = ''
  let refinementInputs: Record<string, string> = {} // Track refinement inputs for each response
  let refiningMessageId: string | null = null // Track which message is being refined
  let sessionId = generateId() // Generate session ID for this chat session
  let historyResponses: any[] = []
  let showHistory = false
  let loadingHistory = false
  let selectedVersions: Record<string, 'original' | number> = {} // Track which version is selected for each response

  // Save selected LLM to localStorage whenever it changes
  $: if (typeof localStorage !== 'undefined' && selectedLLM) {
    localStorage.setItem('resume-chat-llm', selectedLLM)
  }

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

  function generateId() {
    return Math.random().toString(36).substr(2, 9)
  }

  async function generateContent() {
    if (!prompt.trim() || isLoading) return

    const currentPrompt = prompt.trim()
    const currentContext = context.trim()
    const requestId = generateId()
    
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
      llm: selectedLLM,
      id: requestId
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
          llm: selectedLLM,
          sessionId: sessionId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response')
      }

      // Add response to messages
      const responseId = generateId()
      messages = [...messages, {
        type: 'response',
        content: data.answer,
        timestamp: new Date(),
        llm: selectedLLM,
        id: responseId,
        parentId: requestId,
        dbId: data.responseId, // Store database ID
        refinements: []
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

  async function refineResponse(messageId: string) {
    const refinementRequest = refinementInputs[messageId]?.trim()
    if (!refinementRequest || refiningMessageId) return

    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    const originalMessage = messages[messageIndex]
    const originalRequest = messages.find(m => m.id === originalMessage.parentId)

    refiningMessageId = messageId
    error = ''

    try {
      const response = await fetch('/api/resume/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: refinementRequest,
          context: originalRequest?.context || '',
          originalContent: originalMessage.content,
          isRefinement: true,
          responseId: originalMessage.dbId, // Use database ID
          llm: originalMessage.llm || selectedLLM
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refine response')
      }

      // Update the message and add to refinement history
      const updatedMessages = [...messages]
      const refinement = {
        content: data.answer,
        request: refinementRequest,
        timestamp: new Date()
      }
      
      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        // Don't update content - keep original in content field
        refinements: [...(updatedMessages[messageIndex].refinements || []), refinement]
      }
      
      messages = updatedMessages
      
      // Automatically switch to the new refinement version
      const newRefinementIndex = updatedMessages[messageIndex].refinements.length - 1
      selectedVersions[messageId] = newRefinementIndex
      selectedVersions = { ...selectedVersions }
      
      refinementInputs[messageId] = '' // Clear the input

    } catch (err: any) {
      error = err.message || 'An error occurred during refinement'
      console.error('Error refining response:', err)
    } finally {
      refiningMessageId = null
    }
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

  async function loadHistory() {
    if (loadingHistory) return
    
    loadingHistory = true
    error = ''

    try {
      const response = await fetch('/api/resume/history')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load history')
      }

      historyResponses = data.responses
      showHistory = true
    } catch (err: any) {
      error = err.message || 'Failed to load history'
    } finally {
      loadingHistory = false
    }
  }

  function loadResponseFromHistory(historyResponse: any) {
    // Clear current messages and load the selected response
    messages = []
    
    // Add the original request
    const requestId = generateId()
    messages = [...messages, {
      type: 'request',
      content: historyResponse.prompt,
      timestamp: new Date(historyResponse.createdAt),
      prompt: historyResponse.prompt,
      context: historyResponse.context,
      llm: historyResponse.llmProvider,
      id: requestId
    }]

    // Add the response with refinement history
    const responseId = generateId()
    const refinements = historyResponse.refinements?.map((r: any) => ({
      content: r.refinedContent,
      request: r.request,
      timestamp: new Date(r.createdAt)
    })) || []

    messages = [...messages, {
      type: 'response',
      content: historyResponse.currentContent,
      timestamp: new Date(historyResponse.createdAt),
      llm: historyResponse.llmProvider,
      id: responseId,
      parentId: requestId,
      dbId: historyResponse.id,
      refinements
    }]

    showHistory = false
  }

  function getDisplayedContent(message: any, versions: Record<string, 'original' | number>): string {
    if (!message.refinements || message.refinements.length === 0) {
      return message.content
    }

    const selectedVersion = versions[message.id] !== undefined ? versions[message.id] : 'original'
    
    if (selectedVersion === 'original') {
      return message.content
    } else {
      // selectedVersion is the refinement index
      const refinedContent = message.refinements[selectedVersion]?.content
      return refinedContent || message.content
    }
  }

  function switchVersion(messageId: string, version: 'original' | number) {
    selectedVersions[messageId] = version
    selectedVersions = { ...selectedVersions } // Trigger reactivity
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
      <div class="lg:col-span-1 space-y-4">
        <!-- Templates -->
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

        <!-- History -->
        <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">History</h3>
            <button
              on:click={loadHistory}
              disabled={loadingHistory}
              class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 disabled:opacity-50"
            >
              {loadingHistory ? 'Loading...' : showHistory ? 'Hide' : 'Load'}
            </button>
          </div>
          
          {#if showHistory}
            <div class="space-y-2 max-h-96 overflow-y-auto">
              {#each historyResponses as historyResponse}
                <button
                  on:click={() => loadResponseFromHistory(historyResponse)}
                  class="w-full text-left p-3 text-sm rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div class="flex justify-between items-start mb-1">
                    <div class="font-medium text-gray-900 dark:text-white text-xs">
                      {new Date(historyResponse.createdAt).toLocaleDateString()}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      {historyResponse.llmProvider === 'openai' ? '🤖' : '✨'}
                    </div>
                  </div>
                  <div class="text-gray-600 dark:text-gray-300 text-xs line-clamp-2 mb-1">
                    {historyResponse.prompt}
                  </div>
                  {#if historyResponse.refinements?.length > 0}
                    <div class="text-xs text-blue-600 dark:text-blue-400">
                      {historyResponse.refinements.length} refinement{historyResponse.refinements.length !== 1 ? 's' : ''}
                    </div>
                  {/if}
                </button>
              {/each}
              
              {#if historyResponses.length === 0}
                <div class="text-center text-gray-500 dark:text-gray-400 text-sm py-4">
                  No history yet
                </div>
              {/if}
            </div>
          {/if}
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
                          on:click={() => copyToClipboard(getDisplayedContent(message, selectedVersions))}
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
                      {#key selectedVersions[message.id]}
                        <pre class="whitespace-pre-wrap text-sm text-gray-900 dark:text-white font-sans">{getDisplayedContent(message, selectedVersions)}</pre>
                      {/key}
                    </div>

                    <!-- Refinement Input -->
                    <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <div class="flex space-x-2">
                        <input
                          type="text"
                          bind:value={refinementInputs[message.id]}
                          on:keydown={(e) => e.key === 'Enter' && refineResponse(message.id)}
                          placeholder="Ask for changes (e.g., 'Make it more concise', 'Add more technical details')..."
                          disabled={refiningMessageId === message.id}
                          class="flex-1 text-sm border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white placeholder-gray-400 disabled:opacity-50"
                        />
                        <button
                          on:click={() => refineResponse(message.id)}
                          disabled={!refinementInputs[message.id]?.trim() || refiningMessageId === message.id}
                          class="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm rounded-md transition-colors disabled:cursor-not-allowed flex items-center space-x-1"
                        >
                          {#if refiningMessageId === message.id}
                            <svg class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                              <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Refining...</span>
                          {:else}
                            <span>Refine</span>
                          {/if}
                        </button>
                      </div>
                      
                      <!-- Version Switching -->
                      {#if message.refinements && message.refinements.length > 0}
                        <div class="mt-3 text-xs text-gray-500 dark:text-gray-400">
                          <div class="mb-2">
                            <span class="font-medium">Versions:</span>
                            <div class="flex flex-wrap gap-1 mt-1">
                              <button
                                on:click={() => switchVersion(message.id, 'original')}
                                class="px-2 py-1 rounded text-xs transition-colors {selectedVersions[message.id] === 'original' || selectedVersions[message.id] === undefined ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'}"
                              >
                                Original
                              </button>
                              {#each message.refinements as refinement, index}
                                <button
                                  on:click={() => switchVersion(message.id, index)}
                                  class="px-2 py-1 rounded text-xs transition-colors {selectedVersions[message.id] === index ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'}"
                                  title="Refinement: {refinement.request}"
                                >
                                  v{index + 1}
                                </button>
                              {/each}
                            </div>
                          </div>
                          
                          <details>
                            <summary class="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                              {message.refinements.length} refinement{message.refinements.length !== 1 ? 's' : ''} made
                            </summary>
                            <div class="mt-2 space-y-2 pl-3 border-l-2 border-gray-200 dark:border-gray-600">
                              {#each message.refinements as refinement, index}
                                <div class="text-xs {selectedVersions[message.id] === index ? 'bg-blue-50 dark:bg-blue-900 p-2 rounded' : ''}">
                                  <div class="font-medium">"{refinement.request}"</div>
                                  <div class="text-gray-400 dark:text-gray-500">
                                    {formatTime(refinement.timestamp)}
                                    {#if selectedVersions[message.id] === index}
                                      <span class="ml-2 text-blue-600 dark:text-blue-400">← Currently showing</span>
                                    {/if}
                                  </div>
                                </div>
                              {/each}
                            </div>
                          </details>
                        </div>
                      {/if}
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