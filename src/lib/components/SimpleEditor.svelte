<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faBold,
		faItalic,
		faLink,
		faListUl,
		faListOl,
		faUndo,
		faRedo
	} from '@fortawesome/free-solid-svg-icons';

	interface Props {
		content: string;
		placeholder?: string;
		markdown?: boolean;
		toolbar?: boolean;
		editable?: boolean;
		onUpdate?: (content: string) => void;
	}

	let {
		content = $bindable(),
		placeholder = 'Start typing...',
		markdown = false,
		toolbar = true,
		editable = true,
		onUpdate
	}: Props = $props();

	let element: HTMLDivElement;
	let bubbleMenuElement: HTMLDivElement;
	let editor: any = $state(null);

	onMount(async () => {
		if (!browser) return;

		const { Editor } = await import('@tiptap/core');
		const StarterKit = (await import('@tiptap/starter-kit')).default;
		const Placeholder = (await import('@tiptap/extension-placeholder')).default;
		const Link = (await import('@tiptap/extension-link')).default;
		const BubbleMenu = (await import('@tiptap/extension-bubble-menu')).default;

		const extensions: any[] = [
			StarterKit,
			Placeholder.configure({ placeholder }),
			Link.configure({
				openOnClick: false,
				HTMLAttributes: {
					class: 'text-[var(--dash-primary)] hover:underline cursor-pointer'
				}
			}),
			BubbleMenu.configure({
				element: bubbleMenuElement,
				shouldShow: ({ editor: ed, from, to }) => {
					return ed.isEditable && from !== to && !ed.isActive('link');
				}
			})
		];

		if (markdown) {
			const { Markdown } = await import('@tiptap/markdown');
			extensions.push(Markdown);
		}

		editor = new Editor({
			element,
			extensions,
			content,
			editable,
			...(markdown ? { contentType: 'markdown' as const } : {}),
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
					class: 'focus:outline-none px-3 py-2'
				}
			}
		});
	});

	// Sync editable state and reset content when leaving edit mode (e.g. on Cancel).
	$effect(() => {
		if (!editor) return;
		const wasEditable = editor.isEditable;
		if (wasEditable !== editable) {
			editor.setEditable(editable);
			if (!editable) {
				// Discard unsaved edits — restore from canonical `content` prop value.
				editor.commands.setContent(content, markdown ? { contentType: 'markdown' } : undefined);
			}
		}
		const dom = editor.view?.dom as HTMLElement | undefined;
		if (dom) {
			dom.style.minHeight = editable ? '200px' : '';
		}
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
		if (editor?.isActive('link')) {
			editor?.chain().focus().unsetLink().run();
			return;
		}
		const url = window.prompt('URL:');
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

<div class="overflow-hidden rounded-md {editable ? 'border border-[var(--dash-border)]' : ''}">
	<!-- Toolbar -->
	{#if toolbar && editable}
		<div
			class="flex items-center gap-1 border-b border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1"
		>
			<button
				type="button"
				onclick={toggleBold}
				class="rounded p-2 transition-colors hover:bg-[var(--dash-border)] {editor?.isActive('bold')
					? 'bg-[var(--dash-border)] text-[var(--dash-primary)]'
					: 'text-[var(--dash-text-secondary)]'}"
				title="Bold"
			>
				<FontAwesomeIcon icon={faBold} class="h-3.5 w-3.5" />
			</button>
			<button
				type="button"
				onclick={toggleItalic}
				class="rounded p-2 transition-colors hover:bg-[var(--dash-border)] {editor?.isActive(
					'italic'
				)
					? 'bg-[var(--dash-border)] text-[var(--dash-primary)]'
					: 'text-[var(--dash-text-secondary)]'}"
				title="Italic"
			>
				<FontAwesomeIcon icon={faItalic} class="h-3.5 w-3.5" />
			</button>
			<button
				type="button"
				onclick={toggleLink}
				class="rounded p-2 transition-colors hover:bg-[var(--dash-border)] {editor?.isActive('link')
					? 'bg-[var(--dash-border)] text-[var(--dash-primary)]'
					: 'text-[var(--dash-text-secondary)]'}"
				title="Link"
			>
				<FontAwesomeIcon icon={faLink} class="h-3.5 w-3.5" />
			</button>
			<div class="mx-1 h-5 w-px bg-[var(--dash-border)]"></div>
			<button
				type="button"
				onclick={() => toggleHeading(1)}
				class="rounded p-2 transition-colors hover:bg-[var(--dash-border)] {editor?.isActive(
					'heading',
					{ level: 1 }
				)
					? 'bg-[var(--dash-border)] text-[var(--dash-primary)]'
					: 'text-[var(--dash-text-secondary)]'}"
				title="Heading 1"
			>
				<span class="text-sm font-bold">H1</span>
			</button>
			<button
				type="button"
				onclick={() => toggleHeading(2)}
				class="rounded p-2 transition-colors hover:bg-[var(--dash-border)] {editor?.isActive(
					'heading',
					{ level: 2 }
				)
					? 'bg-[var(--dash-border)] text-[var(--dash-primary)]'
					: 'text-[var(--dash-text-secondary)]'}"
				title="Heading 2"
			>
				<span class="text-sm font-bold">H2</span>
			</button>
			<button
				type="button"
				onclick={() => toggleHeading(3)}
				class="rounded p-2 transition-colors hover:bg-[var(--dash-border)] {editor?.isActive(
					'heading',
					{ level: 3 }
				)
					? 'bg-[var(--dash-border)] text-[var(--dash-primary)]'
					: 'text-[var(--dash-text-secondary)]'}"
				title="Heading 3"
			>
				<span class="text-sm font-bold">H3</span>
			</button>
			<button
				type="button"
				onclick={toggleBulletList}
				class="rounded p-2 transition-colors hover:bg-[var(--dash-border)] {editor?.isActive(
					'bulletList'
				)
					? 'bg-[var(--dash-border)] text-[var(--dash-primary)]'
					: 'text-[var(--dash-text-secondary)]'}"
				title="Bullet list"
			>
				<FontAwesomeIcon icon={faListUl} class="h-3.5 w-3.5" />
			</button>
			<button
				type="button"
				onclick={toggleOrderedList}
				class="rounded p-2 transition-colors hover:bg-[var(--dash-border)] {editor?.isActive(
					'orderedList'
				)
					? 'bg-[var(--dash-border)] text-[var(--dash-primary)]'
					: 'text-[var(--dash-text-secondary)]'}"
				title="Numbered list"
			>
				<FontAwesomeIcon icon={faListOl} class="h-3.5 w-3.5" />
			</button>
			<div class="mx-1 h-5 w-px bg-[var(--dash-border)]"></div>
			<button
				type="button"
				onclick={undo}
				class="rounded p-2 text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-border)]"
				title="Undo"
			>
				<FontAwesomeIcon icon={faUndo} class="h-3.5 w-3.5" />
			</button>
			<button
				type="button"
				onclick={redo}
				class="rounded p-2 text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-border)]"
				title="Redo"
			>
				<FontAwesomeIcon icon={faRedo} class="h-3.5 w-3.5" />
			</button>
		</div>
	{/if}

	<!-- Editor -->
	<div bind:this={element} class="prose prose-sm max-w-none text-[var(--dash-text)]"></div>
</div>

<!-- Bubble menu (shown on text selection) -->
<div
	bind:this={bubbleMenuElement}
	class="bubble-menu flex items-center gap-0.5 rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-1 py-0.5 shadow-lg"
>
	{#if editor}
		<button
			type="button"
			onclick={toggleBold}
			class="rounded p-1.5 transition-colors hover:bg-[var(--dash-bg)] {editor.isActive('bold')
				? 'text-[var(--dash-primary)]'
				: 'text-[var(--dash-text-secondary)]'}"
			title="Bold"
		>
			<FontAwesomeIcon icon={faBold} class="h-3 w-3" />
		</button>
		<button
			type="button"
			onclick={toggleItalic}
			class="rounded p-1.5 transition-colors hover:bg-[var(--dash-bg)] {editor.isActive('italic')
				? 'text-[var(--dash-primary)]'
				: 'text-[var(--dash-text-secondary)]'}"
			title="Italic"
		>
			<FontAwesomeIcon icon={faItalic} class="h-3 w-3" />
		</button>
		<button
			type="button"
			onclick={toggleLink}
			class="rounded p-1.5 transition-colors hover:bg-[var(--dash-bg)] {editor.isActive('link')
				? 'text-[var(--dash-primary)]'
				: 'text-[var(--dash-text-secondary)]'}"
			title="Link"
		>
			<FontAwesomeIcon icon={faLink} class="h-3 w-3" />
		</button>
	{/if}
</div>

<style>
	:global(.tiptap p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: var(--dash-text-secondary);
		pointer-events: none;
		height: 0;
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
	:global(.tiptap > *:last-child) {
		margin-bottom: 0;
	}
	:global(.tiptap a) {
		color: var(--dash-primary);
		text-decoration: none;
	}
	:global(.tiptap a:hover) {
		text-decoration: underline;
	}
	.bubble-menu {
		visibility: hidden;
		opacity: 0;
		transition: opacity 0.1s ease;
		z-index: 50;
	}
</style>
