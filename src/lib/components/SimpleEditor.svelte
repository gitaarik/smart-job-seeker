<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBold,
    faItalic,
    faLink,
    faListUl,
    faListOl,
    faUndo,
    faRedo,
  } from "@fortawesome/free-solid-svg-icons";

  interface Props {
    content: string;
    placeholder?: string;
    markdown?: boolean;
    toolbar?: boolean;
    onUpdate?: (content: string) => void;
  }

  let {
    content = $bindable(),
    placeholder = "Start typing...",
    markdown = false,
    toolbar = true,
    onUpdate,
  }: Props = $props();

  let element: HTMLDivElement;
  let editor: any = $state(null);

  onMount(async () => {
    if (!browser) return;

    const { Editor } = await import("@tiptap/core");
    const StarterKit = (await import("@tiptap/starter-kit")).default;
    const Placeholder = (await import("@tiptap/extension-placeholder")).default;
    const Link = (await import("@tiptap/extension-link")).default;

    const extensions: any[] = [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-[var(--dash-primary)] hover:underline cursor-pointer",
        },
      }),
    ];

    if (markdown) {
      const { Markdown } = await import("@tiptap/markdown");
      extensions.push(Markdown);
    }

    editor = new Editor({
      element,
      extensions,
      content,
      ...(markdown ? { contentType: "markdown" as const } : {}),
      onUpdate: ({ editor: ed }) => {
        if (markdown) {
          content = (ed as any).getMarkdown();
        } else {
          content = ed.getHTML();
        }
        onUpdate?.(content);
      },
      editorProps: {
        attributes: {
          class: "focus:outline-none min-h-[200px] px-3 py-2",
        },
      },
    });
  });

  onDestroy(() => {
    editor?.destroy();
  });

  function toggleBold() {
    editor?.chain().focus().toggleBold().run();
  }

  function toggleItalic() {
    editor?.chain().focus().toggleItalic().run();
  }

  function toggleBulletList() {
    editor?.chain().focus().toggleBulletList().run();
  }

  function toggleOrderedList() {
    editor?.chain().focus().toggleOrderedList().run();
  }

  function toggleHeading(level: 1 | 2 | 3) {
    editor?.chain().focus().toggleHeading({ level }).run();
  }

  function toggleLink() {
    if (editor?.isActive("link")) {
      editor?.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("URL:");
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  }

  function undo() {
    editor?.chain().focus().undo().run();
  }

  function redo() {
    editor?.chain().focus().redo().run();
  }
</script>

<div class="border border-[var(--dash-border)] rounded-md overflow-hidden">
  <!-- Toolbar -->
  {#if toolbar}
    <div class="flex items-center gap-1 px-2 py-1 border-b border-[var(--dash-border)] bg-[var(--dash-bg)]">
      <button
        type="button"
        onclick={toggleBold}
        class="p-2 rounded hover:bg-[var(--dash-border)] transition-colors {editor?.isActive('bold') ? 'bg-[var(--dash-border)] text-[var(--dash-primary)]' : 'text-[var(--dash-text-secondary)]'}"
        title="Bold"
      >
        <FontAwesomeIcon icon={faBold} class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onclick={toggleItalic}
        class="p-2 rounded hover:bg-[var(--dash-border)] transition-colors {editor?.isActive('italic') ? 'bg-[var(--dash-border)] text-[var(--dash-primary)]' : 'text-[var(--dash-text-secondary)]'}"
        title="Italic"
      >
        <FontAwesomeIcon icon={faItalic} class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onclick={toggleLink}
        class="p-2 rounded hover:bg-[var(--dash-border)] transition-colors {editor?.isActive('link') ? 'bg-[var(--dash-border)] text-[var(--dash-primary)]' : 'text-[var(--dash-text-secondary)]'}"
        title="Link"
      >
        <FontAwesomeIcon icon={faLink} class="w-3.5 h-3.5" />
      </button>
      <div class="w-px h-5 bg-[var(--dash-border)] mx-1"></div>
      <button
        type="button"
        onclick={() => toggleHeading(1)}
        class="p-2 rounded hover:bg-[var(--dash-border)] transition-colors {editor?.isActive('heading', { level: 1 }) ? 'bg-[var(--dash-border)] text-[var(--dash-primary)]' : 'text-[var(--dash-text-secondary)]'}"
        title="Heading 1"
      >
        <span class="font-bold text-sm">H1</span>
      </button>
      <button
        type="button"
        onclick={() => toggleHeading(2)}
        class="p-2 rounded hover:bg-[var(--dash-border)] transition-colors {editor?.isActive('heading', { level: 2 }) ? 'bg-[var(--dash-border)] text-[var(--dash-primary)]' : 'text-[var(--dash-text-secondary)]'}"
        title="Heading 2"
      >
        <span class="font-bold text-sm">H2</span>
      </button>
      <button
        type="button"
        onclick={() => toggleHeading(3)}
        class="p-2 rounded hover:bg-[var(--dash-border)] transition-colors {editor?.isActive('heading', { level: 3 }) ? 'bg-[var(--dash-border)] text-[var(--dash-primary)]' : 'text-[var(--dash-text-secondary)]'}"
        title="Heading 3"
      >
        <span class="font-bold text-sm">H3</span>
      </button>
      <button
        type="button"
        onclick={toggleBulletList}
        class="p-2 rounded hover:bg-[var(--dash-border)] transition-colors {editor?.isActive('bulletList') ? 'bg-[var(--dash-border)] text-[var(--dash-primary)]' : 'text-[var(--dash-text-secondary)]'}"
        title="Bullet list"
      >
        <FontAwesomeIcon icon={faListUl} class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onclick={toggleOrderedList}
        class="p-2 rounded hover:bg-[var(--dash-border)] transition-colors {editor?.isActive('orderedList') ? 'bg-[var(--dash-border)] text-[var(--dash-primary)]' : 'text-[var(--dash-text-secondary)]'}"
        title="Numbered list"
      >
        <FontAwesomeIcon icon={faListOl} class="w-3.5 h-3.5" />
      </button>
      <div class="w-px h-5 bg-[var(--dash-border)] mx-1"></div>
      <button
        type="button"
        onclick={undo}
        class="p-2 rounded hover:bg-[var(--dash-border)] transition-colors text-[var(--dash-text-secondary)]"
        title="Undo"
      >
        <FontAwesomeIcon icon={faUndo} class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onclick={redo}
        class="p-2 rounded hover:bg-[var(--dash-border)] transition-colors text-[var(--dash-text-secondary)]"
        title="Redo"
      >
        <FontAwesomeIcon icon={faRedo} class="w-3.5 h-3.5" />
      </button>
    </div>
  {/if}

  <!-- Editor -->
  <div bind:this={element} class="prose prose-sm max-w-none text-[var(--dash-text)]"></div>
</div>

<style>
  :global(.tiptap p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    color: var(--dash-text-secondary);
    pointer-events: none;
    height: 0;
  }
  :global(.tiptap) {
    min-height: 200px;
  }
  :global(.tiptap h1) {
    font-size: 1.5em;
    font-weight: 700;
    margin-top: 1em;
    margin-bottom: 0.5em;
  }
  :global(.tiptap h2) {
    font-size: 1.25em;
    font-weight: 600;
    margin-top: 0.85em;
    margin-bottom: 0.5em;
  }
  :global(.tiptap h3) {
    font-size: 1.1em;
    font-weight: 600;
    margin-top: 0.75em;
    margin-bottom: 0.5em;
  }
  :global(.tiptap p) {
    margin-bottom: 0.5em;
  }
  :global(.tiptap ul),
  :global(.tiptap ol) {
    margin-left: 1.25em;
    margin-bottom: 0.5em;
  }
  :global(.tiptap ul) {
    list-style-type: disc;
  }
  :global(.tiptap ol) {
    list-style-type: decimal;
  }
  :global(.tiptap li) {
    margin-bottom: 0.25em;
  }
  :global(.tiptap a) {
    color: var(--dash-primary);
    text-decoration: none;
  }
  :global(.tiptap a:hover) {
    text-decoration: underline;
  }
</style>
