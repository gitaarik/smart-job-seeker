<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { faUsers } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import EmptyState from '../../profile/components/EmptyState.svelte';
	import Card from '../../components/Card.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let users = $derived(data.users);
	let pendingInvitations = $derived(data.pendingInvitations);
	let devices = $derived(data.devices);
	let showAddForm = $state(false);
	let showPendingInvites = $state(false);
	let addingUser = $state(false);
	let showFilter = $state<'all' | 'active' | 'invited'>('all');

	let filteredUsers = $derived(
		showFilter === 'all'
			? users
			: showFilter === 'invited'
				? users.filter((u) => u.hasInvite)
				: users.filter((u) => !u.hasInvite)
	);

	// Add form state
	let newName = $state('');
	let newEmail = $state('');
	let newPassword = $state('');
	let newSendInvite = $state(true);
	let newApproved = $state(true);
	let newStaff = $state(false);
	let newAdmin = $state(false);
	let newPlan = $state('explorer');
	let newPlanMonths = $state(12);
	let newDeviceIds = $state<number[]>([]);

	function resetAddForm() {
		showAddForm = false;
		newName = '';
		newEmail = '';
		newPassword = '';
		newSendInvite = true;
		newApproved = true;
		newStaff = false;
		newAdmin = false;
		newPlan = 'explorer';
		newPlanMonths = 12;
		newDeviceIds = [];
	}

	function toggleDevice(id: number) {
		newDeviceIds = newDeviceIds.includes(id)
			? newDeviceIds.filter((d) => d !== id)
			: [...newDeviceIds, id];
	}

	function handleAddSubmit() {
		addingUser = true;
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			await update();
			addingUser = false;
			if (result.type === 'success') {
				resetAddForm();
			}
		};
	}

	// Only ?/create returns this (grants applied immediately) — the union from
	// the other actions has no `warning`, hence the `in` check.
	let grantWarning = $derived(form && 'warning' in form ? (form.warning as string) : null);

	function formatDate(date: Date | string | null) {
		if (!date) return '—';
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<div class="space-y-6">
	<SectionHeader
		title="Users"
		icon={faUsers}
		showAddButton={!showAddForm && users.length > 0}
		addLabel="Add User"
		onAdd={() => (showAddForm = true)}
	/>

	{#if form?.error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
		</div>
	{/if}

	{#if form?.success}
		<div
			class="rounded-lg border border-green-400 bg-green-50 p-4 dark:border-green-600 dark:bg-green-900/20"
		>
			<p class="text-sm text-green-700 dark:text-green-400">Operation completed successfully.</p>
			{#if grantWarning}
				<p class="mt-1 text-xs text-green-700/80 dark:text-green-400/80">
					{grantWarning}
				</p>
			{/if}
		</div>
	{/if}

	<!-- Add Form -->
	{#if showAddForm}
		<form
			method="POST"
			action={newSendInvite ? '?/invite' : '?/create'}
			use:enhance={handleAddSubmit}
			class="rounded-lg border border-[var(--dash-primary)] bg-[var(--dash-card)] p-4"
		>
			<h3 class="mb-4 font-medium text-[var(--dash-text)]">Add New User</h3>

			<!-- Invite / Password toggle -->
			<div class="mb-4 flex w-fit gap-1 rounded-lg bg-[var(--dash-bg)] p-1">
				<button
					type="button"
					onclick={() => (newSendInvite = true)}
					class="
            rounded-md px-3 py-1.5 text-sm transition-colors {newSendInvite
						? 'bg-[var(--dash-primary)] text-white'
						: 'text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'}
          "
				>
					Send Invite
				</button>
				<button
					type="button"
					onclick={() => (newSendInvite = false)}
					class="
            rounded-md px-3 py-1.5 text-sm transition-colors {!newSendInvite
						? 'bg-[var(--dash-primary)] text-white'
						: 'text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'}
          "
				>
					Set Password
				</button>
			</div>

			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="new-name" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						Name
					</label>
					<input
						type="text"
						id="new-name"
						name="name"
						bind:value={newName}
						placeholder="Full name"
						class="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>
				<div>
					<label for="new-email" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						Email <span class="text-[var(--dash-error)]">*</span>
					</label>
					<input
						type="email"
						id="new-email"
						name="email"
						bind:value={newEmail}
						placeholder="user@example.com"
						required
						class="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>
				{#if !newSendInvite}
					<div>
						<label
							for="new-password"
							class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>
							Password <span class="text-[var(--dash-error)]">*</span>
						</label>
						<input
							type="password"
							id="new-password"
							name="password"
							bind:value={newPassword}
							placeholder="Min 8 characters"
							required
							minlength="8"
							class="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>
				{/if}
				<div class="flex items-end gap-4 pb-1">
					<label class="flex items-center gap-2 text-sm text-[var(--dash-text)]">
						<input
							type="checkbox"
							name="is_approved"
							bind:checked={newApproved}
							class="rounded border-[var(--dash-border)]"
						/>
						Approved
					</label>
					<label class="flex items-center gap-2 text-sm text-[var(--dash-text)]">
						<input
							type="checkbox"
							name="is_staff"
							bind:checked={newStaff}
							class="rounded border-[var(--dash-border)]"
						/>
						Staff
					</label>
					<label class="flex items-center gap-2 text-sm text-[var(--dash-text)]">
						<input
							type="checkbox"
							name="is_admin"
							bind:checked={newAdmin}
							class="rounded border-[var(--dash-border)]"
						/>
						Admin
					</label>
				</div>
			</div>

			<!-- Plan + device grants (applied on acceptance for invites) -->
			<div class="mt-4 space-y-4 border-t border-[var(--dash-border)] pt-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<label for="new-plan" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
							Plan
						</label>
						<select
							id="new-plan"
							name="plan"
							bind:value={newPlan}
							class="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)] capitalize focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						>
							{#each data.planOptions as plan}
								<option value={plan}>
									{plan === 'explorer' ? 'Explorer (free — no grant)' : plan}
								</option>
							{/each}
						</select>
					</div>
					{#if newPlan !== 'explorer'}
						<div>
							<label
								for="new-plan-months"
								class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
							>
								Plan length
							</label>
							<select
								id="new-plan-months"
								name="plan_months"
								bind:value={newPlanMonths}
								class="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
							>
								{#each data.planDurations as months}
									<option value={months}>
										{months} month{months === 1 ? '' : 's'}
									</option>
								{/each}
							</select>
							<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
								{#if newSendInvite}
									Counted from when they accept, not from today.
								{:else}
									Counted from today.
								{/if}
							</p>
						</div>
					{/if}
				</div>

				<div>
					<span class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						Share my devices
					</span>
					{#if devices.length === 0}
						<p class="text-xs text-[var(--dash-text-muted)]">
							You have no connected devices to share. Set one up under
							<code>/jobs/import/devices</code>.
						</p>
					{:else}
						<div class="flex flex-wrap gap-x-4 gap-y-2">
							{#each devices as device}
								<label class="flex items-center gap-2 text-sm text-[var(--dash-text)]">
									<input
										type="checkbox"
										name="device_ids"
										value={device.id}
										checked={newDeviceIds.includes(device.id)}
										onchange={() => toggleDevice(device.id)}
										class="rounded border-[var(--dash-border)]"
									/>
									{device.name}
								</label>
							{/each}
						</div>
						{#if newDeviceIds.length > 0}
							<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
								They'll become an accepted contact of yours so the shared
								{newDeviceIds.length === 1 ? 'device shows' : 'devices show'}
								up under their imports.
							</p>
						{/if}
					{/if}
				</div>
			</div>

			{#if newSendInvite}
				<p class="mt-3 text-xs text-[var(--dash-text-muted)]">
					An invitation email will be sent. The user will set their own password. Any plan and
					devices above are granted when they accept.
				</p>
			{/if}

			<div class="mt-4 flex justify-end gap-2">
				<button
					type="button"
					onclick={resetAddForm}
					class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={addingUser}
					class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if addingUser}
						<Spinner size="w-4 h-4" />
						{newSendInvite ? 'Sending...' : 'Adding...'}
					{:else}
						{newSendInvite ? 'Send Invite' : 'Add User'}
					{/if}
				</button>
			</div>
		</form>
	{/if}

	<!-- Pending Invitations -->
	{#if pendingInvitations.length > 0}
		<div
			class="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800/30 dark:bg-orange-900/10"
		>
			<button
				type="button"
				class="flex w-full cursor-pointer items-center justify-between p-4 text-sm font-medium text-orange-700 dark:text-orange-400"
				onclick={() => (showPendingInvites = !showPendingInvites)}
			>
				<span>Pending Invitations ({pendingInvitations.length})</span>
				<svg
					class="h-4 w-4 transition-transform {showPendingInvites ? 'rotate-180' : ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</button>
			{#if showPendingInvites}
				<div class="space-y-2 px-4 pb-4">
					{#each pendingInvitations as invite}
						<div
							class="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
						>
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<span class="font-medium text-[var(--dash-text)]"
										>{invite.name || invite.email}</span
									>
									{#if invite.is_admin}
										<span
											class="rounded-full bg-purple-500/15 px-1.5 py-0.5 text-xs text-purple-600 dark:text-purple-400"
											>Admin</span
										>
									{/if}
									{#if invite.is_staff}
										<span
											class="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400"
											>Staff</span
										>
									{/if}
									{#if invite.plan && invite.plan !== 'explorer'}
										<span
											class="rounded-full bg-[var(--dash-primary)]/15 px-1.5 py-0.5 text-xs text-[var(--dash-primary)] capitalize"
										>
											{invite.plan}{invite.planMonths ? ` · ${invite.planMonths}mo` : ''}
										</span>
									{/if}
									{#each invite.deviceNames as deviceName}
										<span
											class="rounded-full bg-teal-500/15 px-1.5 py-0.5 text-xs text-teal-600 dark:text-teal-400"
										>
											{deviceName}
										</span>
									{/each}
								</div>
								{#if invite.name}
									<div class="text-xs text-[var(--dash-text-muted)]">{invite.email}</div>
								{/if}
							</div>
							<form
								method="POST"
								action="?/update_invite_expiry"
								use:enhance={() => {
									return async ({ update }) => {
										await update();
									};
								}}
								class="flex flex-shrink-0 items-center gap-1.5"
							>
								<input type="hidden" name="email" value={invite.email} />
								<span class="text-xs text-[var(--dash-text-muted)]">Expires</span>
								<input
									type="date"
									name="expiresAt"
									value={new Date(invite.expiresAt).toISOString().split('T')[0]}
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
									class="cursor-pointer border-b border-dashed border-[var(--dash-text-muted)]/40 bg-transparent px-0.5 text-xs text-[var(--dash-text-muted)] hover:border-[var(--dash-primary)] focus:border-[var(--dash-primary)] focus:outline-none"
								/>
							</form>
							<form
								method="POST"
								action="?/revoke_invite"
								use:enhance={({ cancel }) => {
									if (!confirm(`Revoke invitation for ${invite.email}?`)) {
										cancel();
										return;
									}
									return async ({ update }) => {
										await update();
									};
								}}
							>
								<input type="hidden" name="email" value={invite.email} />
								<button
									type="submit"
									class="text-xs text-[var(--dash-error)]/60 transition-colors hover:text-[var(--dash-error)]"
									>Revoke</button
								>
							</form>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Users List -->
	{#if users.length === 0 && !showAddForm}
		<EmptyState
			icon={faUsers}
			title="No users yet"
			description="Create the first user account to get started."
			actionLabel="Add First User"
			onAction={() => (showAddForm = true)}
		/>
	{:else}
		<div class="space-y-3">
			{#each filteredUsers as user (user.id)}
				<a href="/admin/users/{user.id}" class="block">
					<Card
						class="relative overflow-hidden transition-all hover:border-[var(--dash-primary)]/30"
					>
						<div class="p-3 transition-colors hover:bg-[var(--dash-bg)] sm:p-4">
							<div class="flex items-start gap-3">
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<h3 class="text-sm font-medium text-[var(--dash-text)] sm:text-base">
											{user.name || '(no name)'}
										</h3>
										{#if user.is_admin}
											<span
												class="rounded-full bg-purple-500/15 px-1.5 py-0.5 text-xs text-purple-600 dark:text-purple-400"
												>Admin</span
											>
										{/if}
										{#if user.is_staff}
											<span
												class="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400"
												>Staff</span
											>
										{/if}
										{#if user.is_approved}
											<span
												class="rounded-full bg-green-500/15 px-1.5 py-0.5 text-xs text-green-600 dark:text-green-400"
												>Approved</span
											>
										{:else}
											<span
												class="rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-xs text-yellow-600 dark:text-yellow-400"
												>Pending</span
											>
										{/if}
										{#if user.hasInvite}
											<span
												class="rounded-full bg-orange-500/15 px-1.5 py-0.5 text-xs text-orange-600 dark:text-orange-400"
												>Invited</span
											>
										{/if}
										<span
											class="rounded-full px-1.5 py-0.5 text-xs capitalize {user.plan === 'free'
												? 'bg-[var(--dash-text-muted)]/15 text-[var(--dash-text-muted)]'
												: 'bg-[var(--dash-primary)]/15 text-[var(--dash-primary)]'}"
											>{user.plan}</span
										>
									</div>
									<p class="mt-0.5 text-xs text-[var(--dash-text-secondary)] sm:text-sm">
										{user.email}
									</p>
									<div class="mt-1 flex items-center gap-3 text-xs text-[var(--dash-text-muted)]">
										<span>Joined {formatDate(user.createdAt)}</span>
										<span
											>{user.profileCount}
											{user.profileCount === 1 ? 'profile' : 'profiles'}</span
										>
									</div>
								</div>
							</div>
						</div>
					</Card>
				</a>
			{/each}
		</div>
	{/if}
</div>
