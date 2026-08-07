<script lang="ts">
	import type { PageData } from './$types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faDownload,
		faFileExport,
		faInfoCircle,
		faListUl,
		faEnvelope,
		faBullseye,
		faMoneyBillWave
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../../../components/Card.svelte';

	let { data }: { data: PageData } = $props();

	let includeTasks = $state(true);
	let includeMatch = $state(true);
	let includeDigest = $state(true);
	let includeSalary = $state(true);

	const downloadUrl = $derived.by(() => {
		const params = new URLSearchParams({
			tasks: includeTasks ? '1' : '0',
			match: includeMatch ? '1' : '0',
			digest: includeDigest ? '1' : '0',
			salary: includeSalary ? '1' : '0'
		});
		return `/data/settings-export/download?${params.toString()}`;
	});

	const nothingSelected = $derived(
		!includeTasks && !includeMatch && !includeDigest && !includeSalary
	);
</script>

<div class="space-y-6">
	<Card padding="lg">
		<div class="flex items-start gap-4">
			<div
				class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--dash-bg)]"
			>
				<FontAwesomeIcon icon={faFileExport} class="h-6 w-6 text-indigo-600" />
			</div>
			<div class="flex-1">
				<h3 class="mb-1 font-medium text-[var(--dash-text)]">Export Settings</h3>
				<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
					Pick the sections to include, then download a JSON file you can import into another Smart
					Job Seeker instance.
				</p>

				<div class="mb-4 space-y-2 text-sm">
					<label class="flex cursor-pointer items-center gap-3">
						<input
							type="checkbox"
							bind:checked={includeTasks}
							class="h-4 w-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)]"
						/>
						<FontAwesomeIcon icon={faListUl} class="h-4 w-4 text-[var(--dash-text-muted)]" />
						<span class="text-[var(--dash-text)]">
							{data.taskCount} import task{data.taskCount === 1 ? '' : 's'}
						</span>
					</label>
					<label class="flex cursor-pointer items-center gap-3">
						<input
							type="checkbox"
							bind:checked={includeMatch}
							class="h-4 w-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)]"
						/>
						<FontAwesomeIcon icon={faBullseye} class="h-4 w-4 text-[var(--dash-text-muted)]" />
						<span class="text-[var(--dash-text)]">
							Match config {data.hasMatchConfig ? '(present)' : '(none)'}
						</span>
					</label>
					<label class="flex cursor-pointer items-center gap-3">
						<input
							type="checkbox"
							bind:checked={includeDigest}
							class="h-4 w-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)]"
						/>
						<FontAwesomeIcon icon={faEnvelope} class="h-4 w-4 text-[var(--dash-text-muted)]" />
						<span class="text-[var(--dash-text)]">Email digest preferences</span>
					</label>
					<label class="flex cursor-pointer items-center gap-3">
						<input
							type="checkbox"
							bind:checked={includeSalary}
							class="h-4 w-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)]"
						/>
						<FontAwesomeIcon icon={faMoneyBillWave} class="h-4 w-4 text-[var(--dash-text-muted)]" />
						<span class="text-[var(--dash-text)]">
							Salary settings ({data.salaryExpectationCount} expectation{data.salaryExpectationCount ===
							1
								? ''
								: 's'})
						</span>
					</label>
				</div>

				<a
					href={downloadUrl}
					download
					aria-disabled={nothingSelected}
					tabindex={nothingSelected ? -1 : 0}
					class="inline-flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] {nothingSelected
						? 'pointer-events-none opacity-50'
						: ''}"
				>
					<FontAwesomeIcon icon={faDownload} class="h-4 w-4" />
					Download settings.json
				</a>
			</div>
		</div>
	</Card>

	<Card padding="lg">
		<div class="flex items-start gap-3">
			<FontAwesomeIcon icon={faInfoCircle} class="mt-0.5 h-5 w-5 text-[var(--dash-text-muted)]" />
			<div class="space-y-2 text-sm text-[var(--dash-text-secondary)]">
				<p>
					Devices (self-hosted browser API keys) and platform credentials (logins) are <strong
						>not</strong
					> included — they are tied to the specific server and user account, so they need to be set up
					manually on the target instance.
				</p>
				<p>
					On import, tasks auto-link to one of your existing credentials for the same platform
					(credentials are user-scoped, so they're shared across your profiles). Tasks for platforms
					you haven't set up a credential for are imported without a linked credential.
				</p>
			</div>
		</div>
	</Card>
</div>
