<script lang="ts">
	import { page } from '$app/stores';
	import { tick } from 'svelte';
	import { browser } from '$app/environment';
	import { renderSafeMarkdown } from '$lib/utils/safe-markdown';
	import { timeAgo } from '$lib/format';
	import { agentChatState } from './agent-chat-state.svelte';
	import AutoGrowTextarea from '$lib/components/AutoGrowTextarea.svelte';
	import CopyButton from './CopyButton.svelte';
	import ProposalCard, { type Proposal } from './ProposalCard.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faChevronLeft,
		faClockRotateLeft,
		faComments,
		faPaperPlane,
		faPlus,
		faRobot,
		faTrash,
		faXmark
	} from '@fortawesome/free-solid-svg-icons';

	type ChatMessage = {
		role: 'user' | 'assistant';
		content: string;
		/**
		 * Edits this turn suggested, each awaiting its own decision. A turn asked
		 * to fix a field and rewrite a text proposes both, as two cards.
		 */
		proposals?: Proposal[];
	};
	type ConversationSummary = {
		id: number;
		title: string | null;
		last_message_at: string | null;
	};

	// Per-tab pointer to the thread this tab is showing. Lives in localStorage so
	// it survives a refresh (and a browser restart); a thread idle longer than the
	// window below is abandoned in favour of a fresh one on next open.
	const POINTER_KEY = 'sjs:agentChat:pointer';
	const RESUME_WINDOW_MS = 12 * 60 * 60 * 1000; // 12h

	// Open-state is shared so other entry points (e.g. the mobile menu) can
	// toggle the assistant; scrolls to the bottom whenever it opens. The restore
	// itself lives below, with the profile it needs.
	let isOpen = $derived(agentChatState.open);
	$effect(() => {
		if (isOpen) scrollToBottom();
	});

	let messages = $state<ChatMessage[]>([]);
	let conversationId = $state<number | null>(null);
	let input = $state('');
	let sending = $state(false);
	let errorMsg = $state('');
	let scrollEl = $state<HTMLDivElement>();
	let view = $state<'chat' | 'history'>('chat');
	let conversations = $state<ConversationSummary[]>([]);
	let historyLoading = $state(false);

	// Desktop-only: the panel grows once the user starts typing. Esc and
	// outside-click step it back down (expanded → normal → closed) rather than
	// closing outright. `suppressExpand` stops continued typing from re-growing
	// it right after a step-down; it clears when the input loses focus.
	let expanded = $state(false);
	let suppressExpand = false;

	// Label for the "the assistant can see this page" chip. Purely cosmetic — the
	// context itself is resolved server-side from the route.
	let pageContext = $derived(($page.data as { chatContext?: { label?: string } }).chatContext);
	let profileId = $derived(
		($page.data as { selectedProfile?: { id?: number } }).selectedProfile?.id
	);

	// Switching profile ends the thread rather than carrying it over. The server
	// refuses to append to a thread under a different profile, so without this
	// the open panel would keep showing a conversation whose next message fails —
	// an error where the honest answer is that this is a different applicant now.
	//
	// Only a switch between two REAL profiles counts. Treating undefined → 12 as
	// one would call newChat() the moment layout data resolves, and newChat()
	// drops the resume pointer — so a slow load would silently cost the user the
	// thread they had open, which is the opposite of the point.
	let lastProfileId: number | undefined;
	$effect(() => {
		const current = profileId;
		if (current === undefined) return;
		if (lastProfileId === undefined) {
			lastProfileId = current;
			return;
		}
		if (current === lastProfileId) return;
		lastProfileId = current;
		newChat();
	});

	// Resume the stored thread the first time the panel opens with a profile to
	// resume it AS. Gated on both, not just `isOpen`: the request now carries the
	// profile id, so consuming the one-shot before layout data resolved would
	// spend it on a request that cannot be made and never retry.
	let restored = false;
	$effect(() => {
		if (!isOpen || restored || !profileId) return;
		restored = true;
		restoreFromPointer();
	});

	async function scrollToBottom() {
		await tick();
		if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
	}

	function writePointer() {
		if (!browser) return;
		if (conversationId == null) {
			localStorage.removeItem(POINTER_KEY);
			return;
		}
		localStorage.setItem(
			POINTER_KEY,
			JSON.stringify({ conversationId, profileId, lastActiveAt: Date.now() })
		);
	}

	async function restoreFromPointer() {
		if (!browser || !profileId) return;
		let pointer: { conversationId?: number; profileId?: number; lastActiveAt?: number } | null =
			null;
		try {
			const raw = localStorage.getItem(POINTER_KEY);
			pointer = raw ? JSON.parse(raw) : null;
		} catch {
			pointer = null;
		}
		if (
			!pointer ||
			typeof pointer.conversationId !== 'number' ||
			typeof pointer.lastActiveAt !== 'number'
		)
			return;

		// A thread belongs to the profile it was conducted as, and the server now
		// says so too. Restoring one under a different profile would put a thread
		// on screen that the next message 404s on. Pointers written before this
		// carry no profileId and are simply not restored — one lost resume, once.
		if (pointer.profileId !== profileId) {
			localStorage.removeItem(POINTER_KEY);
			return;
		}

		if (Date.now() - pointer.lastActiveAt > RESUME_WINDOW_MS) {
			// Idle too long — abandon the thread and start fresh.
			localStorage.removeItem(POINTER_KEY);
			return;
		}
		await loadConversation(pointer.conversationId, { silent: true });
	}

	async function loadConversation(id: number, opts?: { silent?: boolean }) {
		if (!profileId) return;
		try {
			const res = await fetch(`/api/ai/agent/conversations/${id}?profile_id=${profileId}`);
			const data = await res.json().catch(() => null);
			if (!res.ok || !data?.success) {
				if (res.status === 404) {
					// The stored thread is gone — drop the pointer.
					conversationId = null;
					writePointer();
				}
				if (!opts?.silent) {
					errorMsg = data?.message || 'Could not load that conversation.';
				}
				return;
			}
			conversationId = id;
			messages = data.messages as ChatMessage[];
			view = 'chat';
			errorMsg = '';
			writePointer();
			scrollToBottom();
		} catch {
			if (!opts?.silent) errorMsg = 'Could not load that conversation.';
		}
	}

	function newChat() {
		conversationId = null;
		messages = [];
		input = '';
		errorMsg = '';
		view = 'chat';
		if (browser) localStorage.removeItem(POINTER_KEY);
	}

	async function openHistory() {
		view = 'history';
		historyLoading = true;
		try {
			const res = await fetch(`/api/ai/agent/conversations?profile_id=${profileId}`);
			const data = await res.json().catch(() => null);
			conversations = res.ok && data?.success ? data.conversations : [];
		} catch {
			conversations = [];
		} finally {
			historyLoading = false;
		}
	}

	async function deleteConversation(id: number) {
		try {
			const res = await fetch(`/api/ai/agent/conversations/${id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				conversations = conversations.filter((c) => c.id !== id);
				if (conversationId === id) newChat();
			}
		} catch {
			// Leave the list as-is; the user can retry.
		}
	}

	async function send() {
		const text = input.trim();
		if (!text || sending) return;
		if (!profileId) {
			errorMsg = 'No profile selected.';
			return;
		}
		errorMsg = '';
		input = '';
		messages = [...messages, { role: 'user', content: text }];
		sending = true;
		scrollToBottom();

		try {
			const res = await fetch('/api/ai/agent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					profile_id: profileId,
					conversation_id: conversationId,
					message: text,
					// Where the user is as they send this — the server resolves what
					// that means (and what they're allowed to see) from the route.
					route: $page.route.id,
					routeParams: $page.params
				})
			});
			const data = await res.json().catch(() => null);
			if (!res.ok || !data?.success) {
				errorMsg = data?.message || 'The assistant could not respond.';
				return;
			}
			conversationId = data.conversation_id;
			messages = [
				...messages,
				{
					role: 'assistant',
					content: data.reply,
					proposals: data.proposals ?? []
				}
			];
			writePointer();
			scrollToBottom();
		} catch {
			errorMsg = 'Failed to reach the assistant. Please try again.';
		} finally {
			sending = false;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	function closeChat() {
		agentChatState.open = false;
		expanded = false;
		suppressExpand = false;
	}

	/** Big screens only — the panel resizing would be pointless on mobile. */
	function isDesktop() {
		return browser && window.matchMedia('(min-width: 1024px)').matches;
	}

	function expandOnType() {
		if (isDesktop() && !suppressExpand) expanded = true;
	}

	/** Esc / outside-click: shrink an expanded panel first, otherwise close. */
	function stepDown() {
		if (isDesktop() && expanded) {
			expanded = false;
			suppressExpand = true; // don't re-grow until the input is re-focused
			return;
		}
		closeChat();
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && agentChatState.open) stepDown();
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<!-- Launcher — desktop only; on mobile the assistant opens from the menu -->
{#if !isOpen}
	<button
		type="button"
		onclick={() => (agentChatState.open = true)}
		class="fixed right-6 bottom-6 z-40 hidden h-12 w-12 items-center justify-center rounded-full bg-[var(--dash-primary)] text-white opacity-60 shadow-lg transition-all hover:scale-105 hover:bg-[var(--dash-primary-hover)] hover:opacity-100 focus-visible:opacity-100 lg:flex"
		aria-label="Open assistant"
	>
		<FontAwesomeIcon icon={faRobot} class="h-5 w-5" />
	</button>
{/if}

<!-- Panel -->
{#if isOpen}
	<!-- Click-catcher: closes the chat when clicking anywhere outside the panel -->
	<button
		type="button"
		class="fixed inset-0 z-40 cursor-default"
		onclick={stepDown}
		aria-label="Close assistant"
		tabindex="-1"
	>
	</button>
	<div
		class="fixed right-6 bottom-6 z-50 flex max-h-[min(70vh,640px)] w-96 flex-col rounded-xl bg-[var(--dash-card)] shadow-[0_0_30px_rgba(0,0,0,0.3)] ring-[3px] ring-[var(--dash-primary)]/60 transition-[width,max-height] duration-200 ease-out max-lg:inset-x-4 max-lg:bottom-24 max-lg:w-auto {expanded
			? 'lg:max-h-[min(88vh,860px)] lg:w-[34rem]'
			: ''}"
	>
		<!-- Header -->
		<div
			class="flex shrink-0 items-center justify-between border-b border-[var(--dash-border)] px-4 py-3"
		>
			<div class="flex min-w-0 items-center gap-2">
				{#if view === 'history'}
					<button
						type="button"
						onclick={() => (view = 'chat')}
						class="-ml-1 p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
						aria-label="Back to chat"
					>
						<FontAwesomeIcon icon={faChevronLeft} class="h-4 w-4" />
					</button>
					<h3 class="text-sm font-semibold text-[var(--dash-text)]">History</h3>
				{:else}
					<FontAwesomeIcon icon={faComments} class="h-4 w-4 text-[var(--dash-primary)]" />
					<h3 class="text-sm font-semibold text-[var(--dash-text)]">Your assistant</h3>
				{/if}
			</div>
			<div class="flex shrink-0 items-center gap-1">
				{#if view === 'chat'}
					<button
						type="button"
						onclick={newChat}
						class="p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
						aria-label="New chat"
						title="New chat"
					>
						<FontAwesomeIcon icon={faPlus} class="h-4 w-4" />
					</button>
					<button
						type="button"
						onclick={openHistory}
						class="p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
						aria-label="Conversation history"
						title="History"
					>
						<FontAwesomeIcon icon={faClockRotateLeft} class="h-4 w-4" />
					</button>
				{/if}
				<button
					type="button"
					onclick={closeChat}
					class="p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
					aria-label="Close assistant"
				>
					<FontAwesomeIcon icon={faXmark} class="h-4 w-4" />
				</button>
			</div>
		</div>

		{#if view === 'history'}
			<!-- History list -->
			<div class="min-h-[120px] flex-1 overflow-y-auto px-2 py-2">
				{#if historyLoading}
					<p class="py-6 text-center text-sm text-[var(--dash-text-muted)]">Loading…</p>
				{:else if conversations.length === 0}
					<p class="py-6 text-center text-sm text-[var(--dash-text-muted)]">
						No past conversations yet.
					</p>
				{:else}
					{#each conversations as c (c.id)}
						<div
							class="group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--dash-bg)] {c.id ===
							conversationId
								? 'bg-[var(--dash-bg)]'
								: ''}"
						>
							<button
								type="button"
								onclick={() => loadConversation(c.id)}
								class="min-w-0 flex-1 text-left"
							>
								<span class="block truncate text-sm text-[var(--dash-text)]">
									{c.title || 'Untitled chat'}
								</span>
								<span class="block text-[11px] text-[var(--dash-text-muted)]">
									{timeAgo(c.last_message_at)}
								</span>
							</button>
							<button
								type="button"
								onclick={() => deleteConversation(c.id)}
								class="shrink-0 p-1.5 text-[var(--dash-text-muted)] opacity-0 transition-all group-hover:opacity-100 hover:text-[var(--dash-error)]"
								aria-label="Delete conversation"
								title="Delete"
							>
								<FontAwesomeIcon icon={faTrash} class="h-3.5 w-3.5" />
							</button>
						</div>
					{/each}
				{/if}
			</div>
		{:else}
			<!-- Page-awareness hint, plus the thread's id: the handle to quote when
           reporting a bad answer, and what `agent_messages.conversation_id`
           is keyed on when digging one up. Absent until the first reply,
           because until then there is no stored conversation. -->
			{#if pageContext?.label || conversationId != null}
				<div
					class="flex shrink-0 items-center gap-3 border-b border-[var(--dash-border)] px-4 py-1.5 text-[11px] text-[var(--dash-text-muted)]"
				>
					{#if pageContext?.label}
						<span class="truncate">
							Looking at: <span class="text-[var(--dash-text-secondary)]">{pageContext.label}</span>
						</span>
					{/if}
					{#if conversationId != null}
						<span class="ml-auto shrink-0">
							<CopyButton
								text={String(conversationId)}
								label="#{conversationId}"
								size="sm"
								title="Conversation ID — copy it to refer to this chat"
							/>
						</span>
					{/if}
				</div>
			{/if}

			<!-- Messages -->
			<div bind:this={scrollEl} class="min-h-[120px] flex-1 space-y-3 overflow-y-auto px-4 py-3">
				{#if messages.length === 0}
					<p class="py-6 text-center text-sm text-[var(--dash-text-muted)]">
						Ask me anything about your job search — your profile, this page, or what to do next.
					</p>
				{/if}
				{#each messages as msg}
					{#if msg.role === 'user'}
						<div class="flex justify-end">
							<div
								class="max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--dash-primary)] px-3 py-2 text-sm whitespace-pre-wrap text-white"
							>
								{msg.content}
							</div>
						</div>
					{:else}
						<div class="flex justify-start">
							<div class="max-w-[90%] min-w-0">
								<div
									class="agent-md rounded-2xl rounded-bl-sm bg-[var(--dash-bg)] px-3 py-2 text-sm text-[var(--dash-text)]"
								>
									{@html renderSafeMarkdown(msg.content)}
								</div>
								{#each msg.proposals ?? [] as proposal (proposal.id)}
									<ProposalCard {proposal} />
								{/each}
							</div>
						</div>
					{/if}
				{/each}
				{#if sending}
					<div class="flex justify-start">
						<div
							class="rounded-2xl rounded-bl-sm bg-[var(--dash-bg)] px-3 py-2 text-sm text-[var(--dash-text-muted)]"
						>
							Thinking…
						</div>
					</div>
				{/if}
			</div>

			{#if errorMsg}
				<p class="shrink-0 px-4 pb-1 text-xs text-[var(--dash-error)]">
					{errorMsg}
				</p>
			{/if}

			<!-- Input -->
			<div class="flex shrink-0 items-end gap-2 border-t border-[var(--dash-border)] px-3 py-3">
				<AutoGrowTextarea
					bind:value={input}
					onkeydown={onKeydown}
					oninput={expandOnType}
					onblur={() => (suppressExpand = false)}
					placeholder="Ask your assistant…"
					maxRows={5}
					class="flex-1 rounded-lg border border-[var(--dash-border)] bg-transparent px-3 py-2 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				/>
				<button
					type="button"
					onclick={send}
					disabled={sending || !input.trim()}
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--dash-primary)] text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
					aria-label="Send"
				>
					<FontAwesomeIcon icon={faPaperPlane} class="h-3.5 w-3.5" />
				</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Light markdown styling for assistant bubbles */
	.agent-md :global(p) {
		margin: 0 0 0.5rem;
	}
	.agent-md :global(p:last-child) {
		margin-bottom: 0;
	}
	.agent-md :global(ul),
	.agent-md :global(ol) {
		margin: 0.25rem 0 0.5rem;
		padding-left: 1.1rem;
		list-style: revert;
	}
	.agent-md :global(li) {
		margin: 0.15rem 0;
	}
	.agent-md :global(strong) {
		font-weight: 600;
	}
	.agent-md :global(a) {
		color: var(--dash-primary);
		text-decoration: underline;
	}
	.agent-md :global(code) {
		background: var(--dash-card);
		padding: 0.05rem 0.3rem;
		border-radius: 0.25rem;
		font-size: 0.85em;
	}
</style>
