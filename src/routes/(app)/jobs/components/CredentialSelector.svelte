<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCheck,
		faChevronDown,
		faChevronRight,
		faEye,
		faEyeSlash,
		faKey,
		faPen,
		faPlus,
		faShareAlt,
		faTimes,
		faTrash,
		faUserMinus
	} from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import { portalToBody } from '$lib/actions/portal';
	import LoginModeChooser from './LoginModeChooser.svelte';
	import { toLoginMode } from '$lib/import-tasks/sign-in';

	interface CredentialEntry {
		id: number;
		username: string | null;
		security_answer?: string | null;
		/** True when the credential is owned by another user and shared with the current user */
		shared?: boolean;
		owner_user_id?: string | null;
		owner_label?: string | null;
	}
	interface ContactUser {
		id: string;
		name: string | null;
		email: string;
	}
	interface CredentialShare {
		id: number;
		date_created: Date | null;
		user: ContactUser & { image: string | null };
	}

	interface Props {
		credentials: CredentialEntry[];
		selectedId: string;
		loginMode: string;
		platformId: number;
		profileId: number;
		platformName?: string | null;
		disabled?: boolean;
		/** When true, the login-mode toggle is hidden and the credential list is
		 *  always rendered (caller is responsible for pinning loginMode to
		 *  "auto"). Used by flows where login is mandatory — e.g. admin
		 *  discovery, which can't proceed without logging in. */
		hideLoginMode?: boolean;
		/**
		 * Whether the platform has a `login_page_url`. Without one the scraper
		 * skips the login phase whatever mode is picked, so the chooser says so
		 * rather than letting the setting look effective. Defaults true because
		 * the admin caller only reaches this component on gated platforms.
		 */
		hasSignInPage?: boolean;
		onselect?: (credentialId: string) => void;
		onloginmodechange?: (mode: string) => void;
		oncredentialadded?: (cred: { id: number; username: string | null }) => void;
		oncredentialdeleted?: (credId: number) => void;
	}

	let {
		credentials = $bindable(),
		selectedId = $bindable(),
		loginMode = $bindable(),
		platformId,
		profileId,
		platformName = null,
		disabled = false,
		hideLoginMode = false,
		hasSignInPage = true,
		onselect,
		onloginmodechange,
		oncredentialadded,
		oncredentialdeleted
	}: Props = $props();

	// Saved credential ID to show "Current" badge
	let savedId = $state(selectedId);

	let isSaving = $state(false);
	let showAddForm = $state(false);
	let newUsername = $state('');
	let newPassword = $state('');
	let newSecurityAnswer = $state('');
	let showPassword = $state(false);
	let showAdvanced = $state(false);
	let isDeletingId = $state<number | null>(null);

	// Inline edit for an existing credential (password + security answer).
	// Password isn't returned from the server, so it stays blank unless the
	// user is changing it.
	let editingCredId = $state<number | null>(null);
	let editPassword = $state('');
	let editSecurityAnswer = $state('');
	let editShowPassword = $state(false);
	let isSavingEdit = $state(false);

	// Share-config modal state
	let sharingCredentialId = $state<number | null>(null);
	let sharingContacts = $state<ContactUser[]>([]);
	let sharingExisting = $state<CredentialShare[]>([]);
	let sharingLoading = $state(false);
	let sharingError = $state<string | null>(null);

	async function openShareModal(credId: number) {
		sharingCredentialId = credId;
		sharingLoading = true;
		sharingError = null;
		try {
			const [contactsRes, sharesRes] = await Promise.all([
				fetch('/api/contacts'),
				fetch(`/api/credential-shares?platformCredentialId=${credId}`)
			]);
			const contactsData = await contactsRes.json();
			const sharesData = await sharesRes.json();
			sharingContacts = (contactsData.contacts || [])
				.filter((c: { status: string }) => c.status === 'accepted')
				.map((c: { user: ContactUser }) => c.user);
			sharingExisting = sharesData.shares || [];
		} catch {
			sharingError = 'Failed to load sharing data';
			sharingCredentialId = null;
		} finally {
			sharingLoading = false;
		}
	}

	function isSharedWith(userId: string): boolean {
		return sharingExisting.some((s) => s.user.id === userId);
	}

	async function shareWithContact(userId: string) {
		if (sharingCredentialId === null) return;
		sharingError = null;
		try {
			const res = await fetch('/api/credential-shares', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					platformCredentialId: sharingCredentialId,
					userId
				})
			});
			if (res.ok) {
				await openShareModal(sharingCredentialId);
			} else {
				const data = await res.json();
				sharingError = data.error || 'Failed to share credential';
			}
		} catch {
			sharingError = 'Failed to share credential';
		}
	}

	async function unshareFromContact(userId: string) {
		if (sharingCredentialId === null) return;
		sharingError = null;
		try {
			const res = await fetch('/api/credential-shares', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					platformCredentialId: sharingCredentialId,
					userId
				})
			});
			if (res.ok) {
				await openShareModal(sharingCredentialId);
			} else {
				const data = await res.json().catch(() => ({}));
				sharingError = data.error || 'Failed to unshare credential';
			}
		} catch {
			sharingError = 'Failed to unshare credential';
		}
	}

	function select(id: string) {
		if (disabled) return;
		showAddForm = false;
		selectedId = id;
		onselect?.(id);
	}

	function setLoginMode(mode: string) {
		if (disabled) return;
		loginMode = mode;
		onloginmodechange?.(mode);
	}

	async function addCredential() {
		if (!newUsername.trim()) return;
		isSaving = true;
		try {
			const response = await fetch(`/api/platforms/${platformId}/credentials`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					profileId,
					username: newUsername.trim(),
					password: newPassword,
					security_answer: newSecurityAnswer || undefined
				})
			});
			if (response.ok) {
				const { id: newId } = await response.json();
				const listRes = await fetch(
					`/api/platforms/${platformId}/credentials?profileId=${profileId}`
				);
				if (listRes.ok) {
					const data = await listRes.json();
					if (Array.isArray(data)) {
						credentials = data;
						const newCred = data.find((c: { id: number }) => c.id === newId);
						if (newCred) {
							selectedId = String(newCred.id);
							onselect?.(selectedId);
							oncredentialadded?.(newCred);
						}
					}
				}
			}
		} catch (err) {
			console.error('Failed to add credential:', err);
		} finally {
			isSaving = false;
			showAddForm = false;
			newUsername = '';
			newPassword = '';
			newSecurityAnswer = '';
			showAdvanced = false;
		}
	}

	async function deleteCredential(credId: number) {
		if (!confirm('Delete this credential? Any search tasks using it will be unlinked.')) return;
		isDeletingId = credId;
		try {
			const response = await fetch(
				`/api/platforms/${platformId}/credentials?profileId=${profileId}&credentialId=${credId}`,
				{ method: 'DELETE' }
			);
			if (response.ok) {
				credentials = credentials.filter((c) => c.id !== credId);
				if (savedId === String(credId)) {
					savedId = 'none';
				}
				if (selectedId === String(credId)) {
					selectedId = savedId;
					onselect?.(selectedId);
				}
				oncredentialdeleted?.(credId);
			}
		} catch (err) {
			console.error('Failed to delete credential:', err);
		} finally {
			isDeletingId = null;
		}
	}

	function startEditCredential(credId: number) {
		const cred = credentials.find((c) => c.id === credId);
		editingCredId = credId;
		editPassword = '';
		editSecurityAnswer = cred?.security_answer || '';
		editShowPassword = false;
	}

	function cancelEditCredential() {
		editingCredId = null;
		editPassword = '';
		editSecurityAnswer = '';
		editShowPassword = false;
	}

	async function saveCredentialEdits() {
		if (editingCredId === null) return;
		const cred = credentials.find((c) => c.id === editingCredId);
		if (!cred) return;

		const body: Record<string, unknown> = {
			profileId,
			credentialId: cred.id,
			username: cred.username || ''
		};
		const passwordChanged = editPassword.length > 0;
		const answerChanged = editSecurityAnswer !== (cred.security_answer || '');
		if (passwordChanged) body.password = editPassword;
		if (answerChanged) body.security_answer = editSecurityAnswer || undefined;
		if (!passwordChanged && !answerChanged) {
			cancelEditCredential();
			return;
		}

		isSavingEdit = true;
		try {
			const response = await fetch(`/api/platforms/${platformId}/credentials`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (response.ok) {
				if (answerChanged) {
					const idx = credentials.findIndex((c) => c.id === editingCredId);
					if (idx >= 0) {
						credentials[idx] = {
							...credentials[idx],
							security_answer: editSecurityAnswer || null
						};
					}
				}
				cancelEditCredential();
			}
		} catch (err) {
			console.error('Failed to save credential:', err);
		} finally {
			isSavingEdit = false;
		}
	}
</script>

<div>
	{#if !hideLoginMode}
		<div class="mb-3">
			<h3 class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">
				How this task signs in
			</h3>
			<LoginModeChooser
				mode={toLoginMode(loginMode)}
				{platformName}
				{hasSignInPage}
				{disabled}
				onchange={setLoginMode}
			/>
		</div>
	{/if}

	<!-- Saved logins, which only the automatic mode uses -->
	{#if loginMode === 'auto'}
		<div class="mt-3 mb-2 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<FontAwesomeIcon icon={faKey} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
				<h2 class="text-sm font-medium text-[var(--dash-text)]">Saved logins</h2>
			</div>
			<div class="flex items-center gap-2">
				{#if isSaving}
					<Spinner size="w-3 h-3" color="var(--dash-text-muted)" />
				{/if}
				{#if !disabled}
					<button
						type="button"
						onclick={() => (showAddForm = !showAddForm)}
						class="flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-bg)]"
					>
						<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
						Add
					</button>
				{/if}
			</div>
		</div>
		<div class="space-y-1.5">
			{#each credentials as cred}
				<div
					class="
            rounded-md transition-colors {selectedId === String(cred.id)
						? 'border border-[var(--dash-primary)]/30 bg-[var(--dash-primary)]/10'
						: 'border border-transparent bg-[var(--dash-bg)] hover:border-[var(--dash-border)]'}
          "
				>
					<div class="flex items-center gap-2.5 px-3 py-2 text-sm">
						<button
							type="button"
							{disabled}
							onclick={() => select(String(cred.id))}
							class="flex flex-1 items-center gap-2.5 text-left text-[var(--dash-text)] disabled:opacity-60"
						>
							<span
								class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 {selectedId ===
								String(cred.id)
									? 'border-[var(--dash-primary)]'
									: 'border-[var(--dash-border)]'}"
							>
								{#if selectedId === String(cred.id)}
									<span class="h-2 w-2 rounded-full bg-[var(--dash-primary)]"></span>
								{/if}
							</span>
							<span>{cred.username || 'No username'}</span>
							{#if savedId === String(cred.id)}
								<span class="text-xs font-medium text-[var(--dash-text-muted)]">Current</span>
							{/if}
							{#if cred.shared}
								<span
									class="rounded-full bg-[var(--dash-primary)]/10 px-1.5 py-0.5 text-xs text-[var(--dash-primary)]"
									title="Shared by {cred.owner_label ?? 'a contact'}"
								>
									shared by {cred.owner_label ?? 'a contact'}
								</span>
							{/if}
						</button>
						{#if !disabled && !cred.shared}
							<button
								type="button"
								onclick={() => {
									if (editingCredId === cred.id) {
										cancelEditCredential();
									} else {
										startEditCredential(cred.id);
									}
								}}
								class="p-1 transition-colors {editingCredId === cred.id
									? 'text-[var(--dash-primary)]'
									: 'text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)]'}"
								title="Edit credential"
							>
								<FontAwesomeIcon icon={faPen} class="h-3 w-3" />
							</button>
							<button
								type="button"
								onclick={() => openShareModal(cred.id)}
								class="p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-primary)]"
								title="Share with a contact"
							>
								<FontAwesomeIcon icon={faShareAlt} class="h-3 w-3" />
							</button>
							<button
								type="button"
								onclick={() => deleteCredential(cred.id)}
								disabled={isDeletingId === cred.id}
								class="p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-error)]"
								title="Delete credential"
							>
								{#if isDeletingId === cred.id}
									<Spinner size="w-3 h-3" />
								{:else}
									<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
								{/if}
							</button>
						{/if}
					</div>

					{#if editingCredId === cred.id && !cred.shared}
						<div class="space-y-2 border-t border-[var(--dash-border)]/50 px-3 pt-1 pb-3">
							<div>
								<label
									for="edit-password-{cred.id}"
									class="mb-1 block text-xs text-[var(--dash-text-secondary)]"
								>
									Password
								</label>
								<div class="relative">
									<input
										type={editShowPassword ? 'text' : 'password'}
										id="edit-password-{cred.id}"
										bind:value={editPassword}
										placeholder="Leave blank to keep current password"
										class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 pr-8 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
									/>
									<button
										type="button"
										onclick={() => (editShowPassword = !editShowPassword)}
										class="absolute top-1/2 right-1.5 -translate-y-1/2 p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
									>
										<FontAwesomeIcon
											icon={editShowPassword ? faEyeSlash : faEye}
											class="h-3.5 w-3.5"
										/>
									</button>
								</div>
							</div>
							<div>
								<label
									for="edit-security-answer-{cred.id}"
									class="mb-1 block text-xs text-[var(--dash-text-secondary)]"
								>
									Security Question Answer
								</label>
								<input
									type="text"
									id="edit-security-answer-{cred.id}"
									bind:value={editSecurityAnswer}
									placeholder="e.g., your mother's maiden name"
									class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
								/>
								<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
									Auto-filled when a site asks a security question after login.
								</p>
							</div>
							<div class="flex justify-end gap-2">
								<button
									type="button"
									onclick={cancelEditCredential}
									class="rounded border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-card)]"
								>
									Cancel
								</button>
								<button
									type="button"
									onclick={saveCredentialEdits}
									disabled={isSavingEdit ||
										(editPassword.length === 0 &&
											editSecurityAnswer === (cred.security_answer || ''))}
									class="flex items-center gap-1 rounded bg-[var(--dash-primary)] px-2 py-1 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
								>
									{#if isSavingEdit}
										<Spinner size="w-3 h-3" />
									{:else}
										<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
									{/if}
									Save
								</button>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if credentials.length === 0 && !showAddForm}
			<p class="mt-2 text-xs text-[var(--dash-text-muted)]">
				No credentials configured{platformName ? ` for ${platformName}` : ''}.
			</p>
		{/if}

		{#if !showAddForm && !disabled && loginMode === 'auto'}
			<button
				type="button"
				onclick={() => (showAddForm = true)}
				class="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--dash-border)] px-3 py-1.5 text-xs font-medium text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-bg)]"
			>
				<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
				Add credentials
			</button>
		{/if}

		{#if showAddForm && !disabled}
			<div class="mt-3 space-y-3 rounded-lg bg-[var(--dash-bg)] p-3">
				<div>
					<label for="new-cred-username" class="mb-1 block text-sm text-[var(--dash-text)]">
						Username / Email
					</label>
					<input
						type="text"
						id="new-cred-username"
						bind:value={newUsername}
						placeholder="your@email.com"
						class="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 text-sm text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>
				<div>
					<label for="new-cred-password" class="mb-1 block text-sm text-[var(--dash-text)]">
						Password
					</label>
					<div class="relative">
						<input
							type={showPassword ? 'text' : 'password'}
							id="new-cred-password"
							bind:value={newPassword}
							placeholder="Enter password"
							class="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 pr-10 text-sm text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							class="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
						>
							<FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} class="h-4 w-4" />
						</button>
					</div>
				</div>
				<!-- Advanced: security answer -->
				<button
					type="button"
					onclick={() => (showAdvanced = !showAdvanced)}
					class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)]"
				>
					{#if showAdvanced}
						<FontAwesomeIcon icon={faChevronDown} class="h-2.5 w-2.5" />
					{:else}
						<FontAwesomeIcon icon={faChevronRight} class="h-2.5 w-2.5" />
					{/if}
					Advanced
				</button>
				{#if showAdvanced}
					<div>
						<label
							for="new-cred-security-answer"
							class="mb-1 block text-xs text-[var(--dash-text-secondary)]"
						>
							Security Question Answer <span class="font-normal text-[var(--dash-text-muted)]"
								>(optional)</span
							>
						</label>
						<input
							type="text"
							id="new-cred-security-answer"
							bind:value={newSecurityAnswer}
							placeholder="e.g., your mother's maiden name"
							class="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
						<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
							Auto-filled when a site asks a security question after login.
						</p>
					</div>
				{/if}
				<div class="flex justify-end gap-2">
					<button
						type="button"
						onclick={() => {
							showAddForm = false;
							newUsername = '';
							newPassword = '';
							newSecurityAnswer = '';
							showAdvanced = false;
						}}
						class="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-card)]"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={addCredential}
						disabled={!newUsername.trim() || isSaving}
						class="flex items-center gap-1 rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isSaving}
							<Spinner size="w-3 h-3" />
						{:else}
							<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
						{/if}
						Add & Select
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Share Credential Modal -->
{#if sharingCredentialId !== null}
	{@const sharingCred = credentials.find((c) => c.id === sharingCredentialId)}
	<div
		use:portalToBody={{
			onClose: () => {
				sharingCredentialId = null;
				sharingError = null;
			}
		}}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-4"
	>
		<div
			class="flex max-h-full w-full max-w-md flex-col rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] shadow-xl sm:max-h-[90vh]"
		>
			<div class="flex items-center justify-between border-b border-[var(--dash-border)] p-4">
				<div>
					<h3 class="font-medium text-[var(--dash-text)]">Share login</h3>
					<p class="mt-0.5 text-xs text-[var(--dash-text-muted)]">
						{sharingCred?.username ?? 'credential'}
						{platformName ? `· ${platformName}` : ''}
					</p>
				</div>
				<button
					type="button"
					onclick={() => {
						sharingCredentialId = null;
						sharingError = null;
					}}
					class="p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
				>
					<FontAwesomeIcon icon={faTimes} class="h-4 w-4" />
				</button>
			</div>

			<div class="overflow-y-auto p-4">
				<p class="mb-3 text-xs text-[var(--dash-text-muted)]">
					Contacts you share this login with can use it on their import tasks but never see the
					password. They can only run it on devices you've also shared with them.
				</p>

				{#if sharingError}
					<div
						class="mb-3 rounded border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-2 text-xs text-[var(--dash-error)]"
					>
						{sharingError}
					</div>
				{/if}

				{#if sharingLoading}
					<div class="flex items-center justify-center py-8">
						<Spinner size="w-6 h-6" />
					</div>
				{:else if sharingContacts.length === 0}
					<div class="py-6 text-center">
						<p class="text-sm text-[var(--dash-text-secondary)]">
							No contacts yet. <a
								href="/contacts"
								class="text-[var(--dash-primary)] hover:underline">Add contacts</a
							> to share logins.
						</p>
					</div>
				{:else}
					{#if sharingExisting.length > 0}
						<div class="mb-4">
							<p
								class="mb-2 text-xs font-medium tracking-wide text-[var(--dash-text-secondary)] uppercase"
							>
								Shared with
							</p>
							<div class="space-y-2">
								{#each sharingExisting as share (share.id)}
									<div
										class="flex items-center justify-between rounded-lg border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/5 px-3 py-2"
									>
										<div class="flex items-center gap-2">
											<div
												class="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--dash-primary)]/20 text-xs font-medium text-[var(--dash-primary)]"
											>
												{(share.user.name || share.user.email)[0].toUpperCase()}
											</div>
											<span class="text-sm text-[var(--dash-text)]">
												{share.user.name || share.user.email}
											</span>
										</div>
										<button
											type="button"
											onclick={() => unshareFromContact(share.user.id)}
											class="p-1 text-[var(--dash-text-muted)] transition-colors hover:text-red-400"
											title="Remove access"
										>
											<FontAwesomeIcon icon={faUserMinus} class="h-3.5 w-3.5" />
										</button>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{@const unsharedContacts = sharingContacts.filter((c) => !isSharedWith(c.id))}
					{#if unsharedContacts.length > 0}
						<div>
							<p
								class="mb-2 text-xs font-medium tracking-wide text-[var(--dash-text-secondary)] uppercase"
							>
								Your contacts
							</p>
							<div class="space-y-1">
								{#each unsharedContacts as contact (contact.id)}
									<button
										type="button"
										onclick={() => shareWithContact(contact.id)}
										class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--dash-bg)]"
									>
										<div
											class="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--dash-text-muted)]/20 text-xs font-medium text-[var(--dash-text-muted)]"
										>
											{(contact.name || contact.email)[0].toUpperCase()}
										</div>
										<span class="text-sm text-[var(--dash-text)]">
											{contact.name || contact.email}
										</span>
									</button>
								{/each}
							</div>
						</div>
					{:else if sharingExisting.length > 0}
						<p class="py-2 text-center text-sm text-[var(--dash-text-secondary)]">
							Shared with all your contacts.
						</p>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}
