<script lang="ts">
  import type { PageData } from "./$types";
  import SearchFormProbeRunCard from "../../components/SearchFormProbeRunCard.svelte";

  let { data }: { data: PageData } = $props();

  let fullscreenModal = $state<HTMLDialogElement | undefined>();
  let fullscreenRawContent = $state('');
  let fullscreenFormattedContent = $state('');
  let fullscreenTitle = $state('');
  let fullscreenType = $state<'raw' | 'stripped'>('raw');

  function credentialLabel(id: number | null): string {
    if (id == null) return "(no credential)";
    const cred = data.credentials.find((c) => c.id === id);
    if (!cred) return `#${id}`;
    return cred.username ?? "(no username)";
  }

  function deviceLabel(apiKeyId: number | null): string | null {
    if (apiKeyId == null) return null;
    const dev = data.devices.find((d) => d.apiKeyId === apiKeyId);
    return dev?.apiKeyName ?? `#${apiKeyId}`;
  }

  function formatHtml(html: string): string {
    if (!html || typeof html !== 'string') return '';

    try {
      // Basic HTML formatting - add indentation and line breaks
      let formatted = html.trim();

      // Add line breaks before opening tags
      formatted = formatted.replace(/</g, '\n<');

      // Add line breaks after closing tags
      formatted = formatted.replace(/>/g, '>\n');

      // Clean up extra line breaks
      formatted = formatted.replace(/\n\s*\n/g, '\n');

      // Basic indentation
      const lines = formatted.split('\n');
      let indentLevel = 0;
      const indentedLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';

        // Decrease indent for closing tags
        if (trimmed.startsWith('</')) {
          indentLevel = Math.max(0, indentLevel - 1);
        }

        const indentedLine = '  '.repeat(indentLevel) + trimmed;

        // Increase indent for opening tags (but not self-closing ones)
        if (trimmed.startsWith('<') &&
            !trimmed.startsWith('</') &&
            !trimmed.endsWith('/>') &&
            !trimmed.includes('<!')) {
          indentLevel++;
        }

        return indentedLine;
      });

      return indentedLines.filter(line => line.trim()).join('\n');
    } catch (error) {
      console.error('Error formatting HTML:', error);
      return html;
    }
  }

  function highlightHtml(html: string): string {
    if (!html) return '';

    return html
      // Escape HTML entities first
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      // Add basic syntax highlighting
      .replace(/(&lt;\/?)([a-zA-Z][a-zA-Z0-9]*)/g, '$1<span class="tag">$2</span>')
      .replace(/(\s)([a-zA-Z-]+)(=)/g, '$1<span class="attr-name">$2</span>$3')
      .replace(/(=)(&quot;[^&]*&quot;|&#x27;[^&#]*&#x27;)/g, '$1<span class="attr-value">$2</span>')
      .replace(/(&lt;!--.*?--&gt;)/gs, '<span class="comment">$1</span>');
  }

  function openFullscreen(content: string, title: string, type: 'raw' | 'stripped') {
    fullscreenRawContent = content;
    fullscreenFormattedContent = formatHtml(content);
    fullscreenTitle = title;
    fullscreenType = type;
    fullscreenModal?.showModal();
  }

  function closeFullscreen() {
    fullscreenModal?.close();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
</script>

<div class="max-w-5xl mx-auto p-6 space-y-6">
  <header class="space-y-1">
    {#if data.platform}
      <a
        href="/admin/job-platforms/{data.platform.id}/discover"
        class="text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)]"
      >← {data.platform.name} discovery</a>
    {:else}
      <a
        href="/admin/job-platforms/search-form-probe"
        class="text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)]"
      >← All discovery runs</a>
    {/if}
    <h1 class="text-xl font-semibold text-[var(--dash-text)] truncate">
      {data.platform?.name ?? "(deleted platform)"} — Run #{data.run.id}
    </h1>
  </header>

  <SearchFormProbeRunCard
    initialRun={data.run}
    initialLogs={data.logs}
    platformName={data.platform?.name ?? null}
    profileId={data.profileId}
    {credentialLabel}
    {deviceLabel}
  />

  <!-- HTML Debug Data Section -->
  {#if data.debugData && data.debugData.length > 0}
    <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg p-6 space-y-4">
      <h2 class="text-lg font-semibold text-[var(--dash-text)] flex items-center gap-2">
        🐞 HTML Debug Data
        <span class="text-sm font-normal text-[var(--dash-text-muted)]">
          ({data.debugData.length} capture{data.debugData.length !== 1 ? 's' : ''})
        </span>
      </h2>
      <p class="text-sm text-[var(--dash-text-muted)]">
        HTML captured during discovery analysis. Compare raw vs stripped HTML to debug LLM analysis issues.
      </p>

      <div class="space-y-4">
        {#each data.debugData as debug}
          <div class="border border-[var(--dash-border)] rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <span class="px-2 py-1 bg-[var(--dash-primary)] text-white text-xs font-medium rounded capitalize">
                  {debug.stage} Page
                </span>
                <span class="text-sm text-[var(--dash-text-muted)]">
                  {new Date(debug.captured_at).toLocaleString()}
                </span>
              </div>
              <a
                href={debug.page_url}
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs text-[var(--dash-primary)] hover:underline"
              >
                {new URL(debug.page_url).hostname}
              </a>
            </div>

            <div class="grid md:grid-cols-2 gap-4">
              <!-- Raw HTML -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-sm font-medium text-[var(--dash-text)]">
                    Raw HTML ({Math.round(debug.raw_html.length / 1024)} KB)
                  </h4>
                  <div class="flex gap-1">
                    <button
                      type="button"
                      class="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      onclick={() => openFullscreen(debug.raw_html, `${debug.stage} Page - Raw HTML`, 'raw')}
                    >
                      Fullscreen
                    </button>
                    <button
                      type="button"
                      class="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                      onclick={() => copyToClipboard(formatHtml(debug.raw_html))}
                      title="Copy formatted HTML"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div class="relative">
                  <pre class="html-view w-full h-48 p-3 border border-[var(--dash-border)] rounded text-xs font-mono overflow-auto"><code class="html">{@html highlightHtml(formatHtml(debug.raw_html.slice(0, 10000)))}{debug.raw_html.length > 10000 ? '\n... (truncated, click Fullscreen to see all)' : ''}</code></pre>
                </div>
              </div>

              <!-- Stripped HTML (what LLM sees) -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-sm font-medium text-[var(--dash-text)]">
                    Stripped HTML - LLM Input ({Math.round(debug.stripped_html.length / 1024)} KB)
                  </h4>
                  <div class="flex gap-1">
                    <button
                      type="button"
                      class="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      onclick={() => openFullscreen(debug.stripped_html, `${debug.stage} Page - Stripped HTML (LLM Input)`, 'stripped')}
                    >
                      Fullscreen
                    </button>
                    <button
                      type="button"
                      class="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                      onclick={() => copyToClipboard(formatHtml(debug.stripped_html))}
                      title="Copy formatted HTML"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div class="relative">
                  <pre class="html-view html-view-stripped w-full h-48 p-3 border border-[var(--dash-border)] rounded text-xs font-mono overflow-auto"><code class="html">{@html highlightHtml(formatHtml(debug.stripped_html.slice(0, 10000)))}{debug.stripped_html.length > 10000 ? '\n... (truncated, click Fullscreen to see all)' : ''}</code></pre>
                </div>
              </div>
            </div>

            <div class="mt-3 text-xs text-[var(--dash-text-muted)]">
              <strong>URL:</strong> {debug.page_url}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Fullscreen HTML Modal -->
<dialog
  bind:this={fullscreenModal}
  class="fullscreen-dialog max-w-none max-h-none w-full h-full p-0 border-0"
  onclick={(e) => e.target === fullscreenModal && closeFullscreen()}
>
  <div class="flex flex-col w-full h-full bg-[var(--dash-card)]">
    <!-- Modal Header -->
    <div class="flex items-center justify-between p-4 border-b border-[var(--dash-border)] bg-[var(--dash-bg-inset)]">
      <div class="flex items-center gap-3">
        <h3 class="text-lg font-semibold text-[var(--dash-text)]">
          {fullscreenTitle}
        </h3>
        <span class="px-2 py-1 text-xs font-medium rounded {fullscreenType === 'raw' ? 'badge-raw' : 'badge-stripped'}">
          {fullscreenType === 'raw' ? 'Raw Browser HTML' : 'Processed LLM Input'}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex gap-2">
          <button
            type="button"
            class="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            onclick={() => copyToClipboard(fullscreenFormattedContent)}
            title="Copy formatted HTML with proper indentation"
          >
            Copy Formatted
          </button>
          <button
            type="button"
            class="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
            onclick={() => copyToClipboard(fullscreenRawContent)}
            title="Copy original HTML exactly as captured"
          >
            Copy Raw
          </button>
        </div>
        <button
          type="button"
          class="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
          onclick={closeFullscreen}
        >
          Close
        </button>
      </div>
    </div>

    <!-- Modal Content -->
    <div class="flex-1 overflow-hidden">
      {#if fullscreenFormattedContent}
        <pre class="html-view w-full h-full p-4 text-xs font-mono overflow-auto {fullscreenType === 'stripped' ? 'html-view-stripped' : ''}"><code class="html">{@html highlightHtml(fullscreenFormattedContent)}</code></pre>
      {:else}
        <div class="flex items-center justify-center h-full text-[var(--dash-text-muted)]">
          <div class="text-center">
            <p class="mb-2">No content available</p>
            <p class="text-sm">Debug info: Raw content length: {fullscreenRawContent?.length || 0}</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
</dialog>

<style>
  /* Theme-aware tokens for the HTML source viewer. The .theme-dark class is
     set on <html> by the theme store, so :global is required to reach it. */
  .html-view {
    --code-bg: #f9fafb;            /* gray-50 */
    --code-bg-stripped: #fefce8;   /* yellow-50 */
    --code-fg: #1f2937;            /* gray-800 */
    --code-tag: #1f7199;
    --code-attr-name: #8f4e8b;
    --code-attr-value: #d14;
    --code-comment: #8a8a7a;
  }

  :global(.theme-dark) .html-view {
    --code-bg: #0b1220;            /* near gray-950 */
    --code-bg-stripped: #2a200b;   /* deep amber */
    --code-fg: #e5e7eb;            /* gray-200 */
    --code-tag: #7dd3fc;           /* sky-300 */
    --code-attr-name: #d8b4fe;     /* purple-300 */
    --code-attr-value: #fca5a5;    /* red-300 */
    --code-comment: #9ca3af;       /* gray-400 */
  }

  .html-view {
    background-color: var(--code-bg);
    color: var(--code-fg);
    line-height: 1.4;
  }

  .html-view.html-view-stripped {
    background-color: var(--code-bg-stripped);
  }

  .html-view :global(.tag) {
    color: var(--code-tag);
    font-weight: 600;
  }

  .html-view :global(.attr-name) {
    color: var(--code-attr-name);
    font-weight: 500;
  }

  .html-view :global(.attr-value) {
    color: var(--code-attr-value);
  }

  .html-view :global(.comment) {
    color: var(--code-comment);
    font-style: italic;
  }

  /* Badges in the modal header */
  .badge-raw {
    background-color: var(--dash-bg-inset);
    color: var(--dash-text-secondary);
  }

  .badge-stripped {
    background-color: var(--dash-warning-light);
    color: var(--dash-warning);
  }

  /* Fullscreen dialog backdrop */
  .fullscreen-dialog {
    backdrop-filter: blur(4px);
    color: var(--dash-text);
  }

  .fullscreen-dialog::backdrop {
    background-color: rgba(0, 0, 0, 0.5);
  }

  /* Improve code readability */
  pre {
    tab-size: 2;
    -moz-tab-size: 2;
  }

  code {
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
