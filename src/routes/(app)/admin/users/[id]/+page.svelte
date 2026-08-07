<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faCheck,
		faCreditCard,
		faEnvelope,
		faGaugeHigh,
		faPencil,
		faSave,
		faSync,
		faTimes,
		faTrash,
		faUserSecret
	} from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../../profile/components/SectionHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import ConfirmModal from '../../../profile/components/ConfirmModal.svelte';
	import Card from '../../../components/Card.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let user = $derived(data.targetUser);
	let subscription = $derived(data.subscription);
	let creditBalance = $derived(data.creditBalance);
	let recentTransactions = $derived(data.recentTransactions);

	let editing = $state(false);
	let editName = $state('');
	let editEmail = $state('');
	let editApproved = $state(false);
	let editStaff = $state(false);
	let editAdmin = $state(false);

	let showDeleteConfirm = $state(false);
	let showClearMatchesConfirm = $state(false);
	let showResetRunLimitsConfirm = $state(false);
	let showResetBillingConfirm = $state(false);
	let sendingInvite = $state(false);
	let clearingMatches = $state(false);
	let resettingRunLimits = $state(false);
	let resettingBilling = $state(false);

	// Subscription form
	let editingSubscription = $state(false);
	let subPlan = $state('');
	let subExpiresAt = $state('');

	function startEdit() {
		editing = true;
		editName = user.name || '';
		editEmail = user.email;
		editApproved = user.is_approved;
		editStaff = user.is_staff;
		editAdmin = user.is_admin;
	}

	function startEditSubscription() {
		editingSubscription = true;
		subPlan = subscription.plan;
		if (subscription.currentPeriodEnd) {
			subExpiresAt = new Date(subscription.currentPeriodEnd).toISOString().split('T')[0];
		} else {
			// Default: 1 month from now
			const d = new Date();
			d.setMonth(d.getMonth() + 1);
			subExpiresAt = d.toISOString().split('T')[0];
		}
	}

	function formatDate(date: Date | string | null) {
		if (!date) return '—';
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function usageColor(percentage: number): string {
		if (percentage >= 90) return 'bg-red-500';
		if (percentage >= 70) return 'bg-amber-500';
		return 'bg-green-500';
	}
</script>

<div class="space-y-6">
	<!-- Header with back link -->
	<div class="flex items-center gap-3">
		<a
			href="/admin/users"
			class="p-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
		>
			<FontAwesomeIcon icon={faArrowLeft} class="h-4 w-4" />
		</a>
		<div class="flex-1">
			<h2 class="text-lg font-semibold text-[var(--dash-text)]">
				{user.name || '(no name)'}
			</h2>
			<p class="text-sm text-[var(--dash-text-secondary)]">{user.email}</p>
		</div>
		<div class="flex flex-wrap items-center gap-1.5">
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
		</div>
	</div>

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
		</div>
	{/if}

	<!-- User Details -->
	<Card>
		<div class="p-4">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="font-medium text-[var(--dash-text)]">User Details</h3>
				{#if !editing}
					<button
						type="button"
						onclick={startEdit}
						class="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-500 transition-colors hover:bg-blue-500/20"
					>
						<FontAwesomeIcon icon={faPencil} class="h-3 w-3" />
						Edit
					</button>
				{/if}
			</div>

			{#if editing}
				<form
					method="POST"
					action="?/update"
					use:enhance={() => {
						return async ({ result, update }) => {
							await update();
							if (result.type === 'success') {
								editing = false;
							}
						};
					}}
				>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label for="edit-name" class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
								>Name</label
							>
							<input
								type="text"
								id="edit-name"
								name="name"
								bind:value={editName}
								class="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
							/>
						</div>
						<div>
							<label for="edit-email" class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
								>Email</label
							>
							<input
								type="email"
								id="edit-email"
								name="email"
								bind:value={editEmail}
								required
								class="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
							/>
						</div>
					</div>
					<div class="mt-4 flex items-center gap-4">
						<label class="flex items-center gap-2 text-sm text-[var(--dash-text)]">
							<input
								type="checkbox"
								name="is_approved"
								bind:checked={editApproved}
								class="rounded border-[var(--dash-border)]"
							/>
							Approved
						</label>
						<label class="flex items-center gap-2 text-sm text-[var(--dash-text)]">
							<input
								type="checkbox"
								name="is_staff"
								bind:checked={editStaff}
								class="rounded border-[var(--dash-border)]"
							/>
							Staff
						</label>
						<label class="flex items-center gap-2 text-sm text-[var(--dash-text)]">
							<input
								type="checkbox"
								name="is_admin"
								bind:checked={editAdmin}
								class="rounded border-[var(--dash-border)]"
							/>
							Admin
						</label>
					</div>
					<div class="mt-4 flex justify-end gap-2">
						<button
							type="button"
							onclick={() => (editing = false)}
							class="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
						>
							Save
						</button>
					</div>
				</form>
			{:else}
				<div class="grid grid-cols-2 gap-y-2 text-sm">
					<span class="text-[var(--dash-text-muted)]">Name</span>
					<span class="text-[var(--dash-text)]">{user.name || '—'}</span>
					<span class="text-[var(--dash-text-muted)]">Email</span>
					<span class="text-[var(--dash-text)]">{user.email}</span>
					<span class="text-[var(--dash-text-muted)]">Joined</span>
					<span class="text-[var(--dash-text)]">{formatDate(user.createdAt)}</span>
					<span class="text-[var(--dash-text-muted)]">Profiles</span>
					<span class="text-[var(--dash-text)]">{user.profileCount}</span>
				</div>
			{/if}
		</div>
	</Card>

	<!-- Subscription -->
	<Card>
		<div class="p-4">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="font-medium text-[var(--dash-text)]">Subscription</h3>
				{#if !editingSubscription}
					<button
						type="button"
						onclick={startEditSubscription}
						class="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-500 transition-colors hover:bg-blue-500/20"
					>
						<FontAwesomeIcon icon={faPencil} class="h-3 w-3" />
						Change
					</button>
				{/if}
			</div>

			{#if editingSubscription}
				<form
					method="POST"
					action="?/set_subscription"
					use:enhance={() => {
						return async ({ result, update }) => {
							await update();
							if (result.type === 'success') {
								editingSubscription = false;
							}
						};
					}}
				>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label for="sub-plan" class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
								>Plan</label
							>
							<select
								id="sub-plan"
								name="plan"
								bind:value={subPlan}
								class="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
							>
								{#each data.planOptions as plan}
									<option value={plan}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</option>
								{/each}
							</select>
						</div>
						{#if subPlan !== 'explorer'}
							<div>
								<label
									for="sub-expires"
									class="mb-1 block text-sm font-medium text-[var(--dash-text)]">Expires</label
								>
								<input
									type="date"
									id="sub-expires"
									name="expires_at"
									bind:value={subExpiresAt}
									class="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
								/>
							</div>
						{/if}
					</div>
					<p class="mt-2 text-xs text-[var(--dash-text-muted)]">
						This is an admin override. No Stripe charge will be created.
					</p>
					<div class="mt-4 flex justify-end gap-2">
						<button
							type="button"
							onclick={() => (editingSubscription = false)}
							class="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
						>
							Save
						</button>
					</div>
				</form>
			{:else}
				<div class="grid grid-cols-2 gap-y-2 text-sm">
					<span class="text-[var(--dash-text-muted)]">Plan</span>
					<span class="text-[var(--dash-text)] capitalize">{subscription.plan}</span>
					<span class="text-[var(--dash-text-muted)]">Status</span>
					<span class="text-[var(--dash-text)] capitalize">{subscription.status}</span>
					<span class="text-[var(--dash-text-muted)]">Period ends</span>
					<span class="text-[var(--dash-text)]">{formatDate(subscription.currentPeriodEnd)}</span>
					{#if subscription.cancelAtPeriodEnd}
						<span class="text-[var(--dash-text-muted)]">Cancels at end</span>
						<span class="text-amber-500">Yes</span>
					{/if}
				</div>
			{/if}
		</div>
	</Card>

	<!-- Credits -->
	<Card>
		<div class="p-4">
			<h3 class="mb-3 font-medium text-[var(--dash-text)]">
				Credits ({creditBalance.period})
			</h3>
			{#if creditBalance}
				{@const total = creditBalance.allowance + creditBalance.extra}
				{@const percentage = total > 0 ? Math.round((creditBalance.used / total) * 100) : 0}
				<div class="mb-1 flex justify-between text-sm">
					<span class="text-[var(--dash-text-secondary)]">Available</span>
					<span class="font-semibold text-[var(--dash-text)]">
						{creditBalance.available}
						<span class="font-normal text-[var(--dash-text-muted)]">
							/ {creditBalance.allowance}{creditBalance.extra > 0
								? ` +${creditBalance.extra} extra`
								: ''}
						</span>
					</span>
				</div>
				<div class="mb-4 h-1.5 rounded-full bg-[var(--dash-border)]">
					<div
						class="{usageColor(percentage)} h-full rounded-full transition-all"
						style="width: {Math.min(percentage, 100)}%"
					></div>
				</div>
			{/if}

			{#if recentTransactions.length > 0}
				<h4 class="mb-2 text-xs font-medium text-[var(--dash-text-muted)]">Recent Activity</h4>
				<div class="space-y-1 text-xs">
					{#each recentTransactions as tx}
						<div class="flex justify-between">
							<span class="text-[var(--dash-text-secondary)]"
								>{tx.operation}{tx.description ? ` — ${tx.description}` : ''}</span
							>
							<span class={tx.amount > 0 ? 'text-green-600' : 'text-[var(--dash-text)]'}
								>{tx.amount > 0 ? '+' : ''}{tx.amount}</span
							>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</Card>

	<!-- Actions -->
	<Card>
		<div class="p-4">
			<h3 class="mb-3 font-medium text-[var(--dash-text)]">Actions</h3>
			<div class="flex flex-wrap gap-2">
				<form
					method="POST"
					action="?/send_invite"
					use:enhance={() => {
						sendingInvite = true;
						return async ({ update }) => {
							await update();
							sendingInvite = false;
						};
					}}
				>
					<button
						type="submit"
						disabled={sendingInvite}
						class="flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-500 transition-colors hover:border-orange-500/50 hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if sendingInvite}
							<Spinner size="w-3 h-3" />
							Sending...
						{:else}
							<FontAwesomeIcon icon={faEnvelope} class="h-3 w-3" />
							{user.hasInvite ? 'Re-send Invitation' : 'Send Invitation'}
						{/if}
					</button>
				</form>

				<button
					type="button"
					disabled={clearingMatches}
					onclick={() => (showClearMatchesConfirm = true)}
					class="flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-500 transition-colors hover:border-orange-500/50 hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if clearingMatches}
						<Spinner size="w-3 h-3" />
						Clearing...
					{:else}
						<FontAwesomeIcon icon={faSync} class="h-3 w-3" />
						Clear matches
					{/if}
				</button>

				<button
					type="button"
					disabled={resettingRunLimits}
					onclick={() => (showResetRunLimitsConfirm = true)}
					class="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-500 transition-colors hover:border-blue-500/50 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if resettingRunLimits}
						<Spinner size="w-3 h-3" />
						Resetting...
					{:else}
						<FontAwesomeIcon icon={faGaugeHigh} class="h-3 w-3" />
						Reset run limits
					{/if}
				</button>

				<button
					type="button"
					disabled={resettingBilling}
					onclick={() => (showResetBillingConfirm = true)}
					class="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600 transition-colors hover:border-amber-500/50 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-400"
				>
					{#if resettingBilling}
						<Spinner size="w-3 h-3" />
						Resetting...
					{:else}
						<FontAwesomeIcon icon={faCreditCard} class="h-3 w-3" />
						Reset billing usage
					{/if}
				</button>

				{#if user.id !== data.user?.id}
					<form method="POST" action="?/impersonate">
						<button
							type="submit"
							class="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-500 transition-colors hover:border-purple-500/50 hover:bg-purple-500/20"
						>
							<FontAwesomeIcon icon={faUserSecret} class="h-3 w-3" />
							Login as
						</button>
					</form>
				{/if}

				<button
					type="button"
					onclick={() => (showDeleteConfirm = true)}
					class="flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs text-[var(--dash-text)] transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
				>
					<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
					Delete User
				</button>
			</div>
		</div>
	</Card>
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
	isOpen={showDeleteConfirm}
	title="Delete User"
	message="Are you sure you want to delete this user? All their sessions and accounts will be removed. This action cannot be undone."
	onCancel={() => (showDeleteConfirm = false)}
	onConfirm={() => {
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/delete';
		document.body.appendChild(form);
		form.submit();
	}}
/>

<!-- Clear Matches Confirmation Modal -->
<ConfirmModal
	isOpen={showClearMatchesConfirm}
	title="Clear Score Data"
	message="This will delete all score data for this user's jobs. They will be re-scored in the next matcher cycle."
	confirmLabel="Clear Score Data"
	onCancel={() => (showClearMatchesConfirm = false)}
	onConfirm={() => {
		clearingMatches = true;
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/clear_matches';
		document.body.appendChild(form);
		form.submit();
	}}
/>

<!-- Reset Run Limits Confirmation Modal -->
<ConfirmModal
	isOpen={showResetRunLimitsConfirm}
	title="Reset run limits"
	message="This deletes this user's scrape-run history, which clears their device rate limit (incl. the 'shared device' daily cap), the min-spacing between runs, and the demo run cap. Run logs for these runs are also removed. No billing or credits are affected."
	confirmLabel="Reset run limits"
	onCancel={() => (showResetRunLimitsConfirm = false)}
	onConfirm={() => {
		resettingRunLimits = true;
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/reset_run_limits';
		document.body.appendChild(form);
		form.submit();
	}}
/>

<!-- Reset Billing Usage Confirmation Modal -->
<ConfirmModal
	isOpen={showResetBillingConfirm}
	title="Reset billing usage"
	message="This zeroes the user's usage counters and credits used for the current period, granting them a fresh quota. Plan allowance and purchased extras are kept. This effectively gives free usage — use deliberately."
	confirmLabel="Reset billing usage"
	onCancel={() => (showResetBillingConfirm = false)}
	onConfirm={() => {
		resettingBilling = true;
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/reset_billing_usage';
		document.body.appendChild(form);
		form.submit();
	}}
/>
