<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faPlug, faTrash } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/**
	 * What each scope means, in the terms someone deciding actually needs.
	 *
	 * Written as consequences rather than as permissions. "propose" is the
	 * default and is described first as what it prevents, because the reason to
	 * pick it is what it stops rather than what it allows.
	 */
	const SCOPES = [
		{
			value: 'read',
			label: 'Read only',
			blurb: 'It can see your profile. It cannot change anything at all.'
		},
		{
			value: 'propose',
			label: 'Ask before changing (recommended)',
			blurb:
				'It can see your profile and ask for changes. Nothing is written until you say yes here.'
		},
		{
			value: 'write',
			label: 'Add things directly',
			blurb:
				'It can add new entries and fill in blanks without asking. Rewriting anything you wrote, ' +
				'and hiding entries, still needs your approval — that never changes.'
		}
	];

	const SCOPE_LABELS: Record<string, string> = {
		read: 'Read only',
		propose: 'Asks before changing',
		write: 'Adds directly'
	};

	/**
	 * The second decision, and the one that is easy to get wrong by not being
	 * asked. Everything under "your own record" was written by you or by this
	 * app; the documents half is what other people sent you, and an app that can
	 * read those is an app you are trusting with your correspondence.
	 */
	const READ_SCOPES = [
		{
			value: 'record',
			label: 'Your own record (recommended)',
			blurb:
				'Your profile, your jobs, your applications and their history — including what each ' +
				'entry is called, but not what it says.'
		},
		{
			value: 'documents',
			label: 'Everything you have collected',
			blurb:
				'Also the text of what you attached and were sent: interview transcripts, recruiter ' +
				'emails, offers, uploaded documents. Give this only to an app you would forward ' +
				'those to.'
		}
	];

	const READ_SCOPE_LABELS: Record<string, string> = {
		record: 'reads your record',
		documents: 'reads your documents too'
	};

	const endpoint = $derived(`${page.url.origin}/api/mcp`);

	function when(date: Date | string | null): string {
		if (!date) return 'never';
		return new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
	}
</script>

<svelte:head>
	<title>Connected Apps - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader title="Connected Apps" icon={faPlug} />

	<p class="text-[var(--dash-text-secondary)]">
		Give an AI assistant outside Smart Job Seeker — Claude, an editor, your own script — access to
		one profile, over the Model Context Protocol. Each key is tied to a single profile and can be
		revoked on its own.
	</p>

	<div class="rounded-lg border border-[var(--dash-border)] p-4">
		<h2 class="font-semibold">Server address</h2>
		<p class="mt-1 text-sm text-[var(--dash-text-secondary)]">
			Point the client at this URL and give it the key as a bearer token.
		</p>
		<code class="mt-2 block rounded bg-[var(--dash-surface-hover)] p-2 text-sm break-all">
			{endpoint}
		</code>
	</div>

	{#if form?.error}
		<p
			class="rounded-lg border p-3 text-sm"
			style="background-color: var(--dash-error-light); border-color: var(--dash-error); color: var(--dash-error);"
		>
			{form.error}
		</p>
	{/if}

	{#if form?.created}
		<!--
			Shown once, prominently. The row does keep the key readable, but the
			moment it is first created is the one the person is actually looking at,
			and a key they never copied is a client they cannot configure.
		-->
		<div
			class="rounded-lg border p-4"
			style="border-color: var(--dash-primary); background-color: var(--dash-surface-hover);"
		>
			<h2 class="font-semibold">{form.created.name} is connected</h2>
			<p class="mt-1 text-sm text-[var(--dash-text-secondary)]">
				Copy this into the client now. Treat it like a password.
			</p>
			<code class="mt-2 block rounded bg-[var(--dash-surface)] p-2 text-sm break-all">
				{form.created.key}
			</code>
		</div>
	{/if}

	<form
		method="POST"
		action="?/create"
		class="space-y-4 rounded-lg border border-[var(--dash-border)] p-4"
		use:enhance
	>
		<h2 class="font-semibold">Connect an app</h2>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="block">
				<span class="text-sm text-[var(--dash-text-secondary)]">What is it?</span>
				<input
					name="name"
					required
					placeholder="Claude Desktop"
					class="mt-1 w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2"
				/>
			</label>

			<label class="block">
				<span class="text-sm text-[var(--dash-text-secondary)]">Which profile?</span>
				<select
					name="profile_id"
					class="mt-1 w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2"
				>
					{#each data.profiles as profile (profile.id)}
						<option value={profile.id} selected={profile.id === data.selectedProfileId}>
							{profile.name ?? `Profile ${profile.id}`}
						</option>
					{/each}
				</select>
			</label>
		</div>

		<fieldset class="space-y-2">
			<legend class="text-sm text-[var(--dash-text-secondary)]">What may it do?</legend>
			{#each SCOPES as scope (scope.value)}
				<label class="flex gap-3 rounded-md border border-[var(--dash-border)] p-3">
					<input
						type="radio"
						name="scope"
						value={scope.value}
						checked={scope.value === 'propose'}
						class="mt-1"
					/>
					<span>
						<span class="block font-medium">{scope.label}</span>
						<span class="block text-sm text-[var(--dash-text-secondary)]">{scope.blurb}</span>
					</span>
				</label>
			{/each}
		</fieldset>

		<fieldset class="space-y-2">
			<legend class="text-sm text-[var(--dash-text-secondary)]">What may it see?</legend>
			{#each READ_SCOPES as readScope (readScope.value)}
				<label class="flex gap-3 rounded-md border border-[var(--dash-border)] p-3">
					<input
						type="radio"
						name="read_scope"
						value={readScope.value}
						checked={readScope.value === 'record'}
						class="mt-1"
					/>
					<span>
						<span class="block font-medium">{readScope.label}</span>
						<span class="block text-sm text-[var(--dash-text-secondary)]">{readScope.blurb}</span>
					</span>
				</label>
			{/each}
		</fieldset>

		<button
			type="submit"
			class="rounded-md px-4 py-2 text-sm text-white"
			style="background-color: var(--dash-primary);"
		>
			Create key
		</button>
	</form>

	{#if data.keys.length === 0}
		<p class="rounded-lg border border-[var(--dash-border)] p-6 text-[var(--dash-text-secondary)]">
			No apps connected yet.
		</p>
	{:else}
		<ul class="space-y-3">
			{#each data.keys as key (key.id)}
				<li class="rounded-lg border border-[var(--dash-border)] p-4">
					<div class="flex flex-wrap items-baseline justify-between gap-2">
						<div>
							<h3 class="font-semibold">
								{key.name}
								{#if key.revoked}
									<span class="text-sm font-normal text-[var(--dash-text-secondary)]"
										>— revoked</span
									>
								{/if}
							</h3>
							<p class="text-sm text-[var(--dash-text-secondary)]">
								{key.profileName ?? `Profile ${key.profileId}`} · {SCOPE_LABELS[key.scope] ??
									key.scope} · {READ_SCOPE_LABELS[key.readScope] ?? key.readScope} · last used
								{when(key.lastUsed)}
							</p>
						</div>

						{#if !key.revoked}
							<form method="POST" action="?/revoke" use:enhance>
								<input type="hidden" name="id" value={key.id} />
								<button
									type="submit"
									class="flex items-center gap-2 rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm hover:bg-[var(--dash-surface-hover)]"
								>
									<FontAwesomeIcon icon={faTrash} class="h-3.5 w-3.5" />
									Revoke
								</button>
							</form>
						{/if}
					</div>

					{#if key.key && !key.revoked}
						<code class="mt-3 block rounded bg-[var(--dash-surface-hover)] p-2 text-xs break-all">
							{key.key}
						</code>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
