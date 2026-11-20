<script lang="ts">
	/*
	 * The desktop app's installer for the visitor's OS, and how to get past the
	 * first launch.
	 *
	 * The installers are not code-signed (decided 2026-11-16, see
	 * sjs-ops docs/DESKTOP-APP.md § What a public release needs), so Windows
	 * SmartScreen and macOS Gatekeeper both stop the first launch. A stranger
	 * who meets "Windows protected your PC" with no word from us reads it as
	 * malware, so the way past it sits right under the download button.
	 */
	import { onMount } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faApple, faLinux, faWindows } from '@fortawesome/free-brands-svg-icons';
	import { faDownload } from '@fortawesome/free-solid-svg-icons';
	import ExternalLink from '#lib/components/ExternalLink.svelte';
	import type { DesktopDownload, DesktopDownloads } from '#lib/server/desktop-release.ts';

	interface Props {
		downloads: Promise<DesktopDownloads>;
	}

	let { downloads }: Props = $props();

	// Where a button goes while the lookup runs or after it failed. The same
	// URL as DESKTOP_RELEASES_URL in $lib/server/desktop-release, which client
	// code cannot import.
	const releasesUrl = 'https://github.com/gitaarik/sjs-desktop/releases/latest';

	type Os = 'windows' | 'mac' | 'linux';
	const OSES: { id: Os; label: string; icon: typeof faApple }[] = [
		{ id: 'windows', label: 'Windows', icon: faWindows },
		{ id: 'mac', label: 'macOS', icon: faApple },
		{ id: 'linux', label: 'Linux', icon: faLinux }
	];

	// Windows until the browser says otherwise: SSR has no user agent, and
	// Windows is the likeliest visitor.
	let os = $state<Os>('windows');

	onMount(() => {
		const ua = navigator.userAgent;
		if (/Mac OS X|Macintosh/.test(ua)) os = 'mac';
		else if (/Linux/.test(ua) && !/Android/.test(ua)) os = 'linux';
	});

	function sizeLabel(d: DesktopDownload): string {
		return `${Math.round(d.size / 1_000_000)} MB`;
	}
</script>

{#snippet button(d: DesktopDownload | null, label: string, primary: boolean)}
	<ExternalLink
		href={d?.url ?? releasesUrl}
		target={d ? '_self' : '_blank'}
		class="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {primary
			? 'bg-[var(--dash-primary)] text-white hover:opacity-90'
			: 'border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
	>
		<FontAwesomeIcon icon={faDownload} class="h-3 w-3" />
		<span>{label}</span>
		{#if d}<span class="opacity-70">{sizeLabel(d)}</span>{/if}
	</ExternalLink>
{/snippet}

<div class="mb-3 flex w-fit overflow-hidden rounded-md border border-[var(--dash-border)]">
	{#each OSES as o, i (o.id)}
		<button
			type="button"
			onclick={() => {
				os = o.id;
			}}
			class="flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors {i > 0
				? 'border-l border-[var(--dash-border)]'
				: ''} {os === o.id
				? 'bg-[var(--dash-primary)] text-white'
				: 'bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
			aria-pressed={os === o.id}
		>
			<FontAwesomeIcon icon={o.icon} class="h-3 w-3" />
			{o.label}
		</button>
	{/each}
</div>

{#await downloads}
	<div class="flex flex-wrap gap-2">
		{@render button(null, 'Download', true)}
	</div>
{:then d}
	<div class="flex flex-wrap items-center gap-2">
		{#if os === 'windows'}
			{@render button(d.windowsExe, 'Windows installer (.exe)', true)}
			{#if d.windowsMsi}{@render button(d.windowsMsi, '.msi', false)}{/if}
		{:else if os === 'mac'}
			{@render button(d.macArm, 'Apple Silicon (M1 or later)', true)}
			{@render button(d.macIntel, 'Intel Mac', false)}
		{:else}
			{@render button(d.linuxAppImage, 'AppImage', true)}
			{#if d.linuxDeb}{@render button(d.linuxDeb, '.deb', false)}{/if}
			{#if d.linuxRpm}{@render button(d.linuxRpm, '.rpm', false)}{/if}
		{/if}
		{#if d.version}
			<span class="text-xs text-[var(--dash-text-muted)]">version {d.version}</span>
		{/if}
	</div>
{/await}

<div class="mt-3 rounded-lg bg-[var(--dash-bg)] p-3 text-xs text-[var(--dash-text-secondary)]">
	<p class="mb-1.5 font-medium text-[var(--dash-text)]">First launch</p>
	{#if os === 'windows'}
		<p class="mb-1.5">
			The app is not code-signed yet, so Windows warns you before it installs. That is expected.
		</p>
		<ol class="list-decimal space-y-0.5 pl-4">
			<li>Run the installer you downloaded.</li>
			<li>
				If you see <strong>"Windows protected your PC"</strong>, click <strong>More info</strong>,
				then <strong>Run anyway</strong>.
			</li>
			<li>Follow the installer, then open Smart Job Seeker from the Start menu.</li>
		</ol>
	{:else if os === 'mac'}
		<p class="mb-1.5">
			The app is not notarized by Apple yet, so macOS refuses to open it the first time. That is
			expected. Not sure which Mac you have? Apple menu &rarr; <strong>About This Mac</strong>: a
			chip named "Apple M&hellip;" is Apple Silicon.
		</p>
		<ol class="list-decimal space-y-0.5 pl-4">
			<li>Open the <code>.dmg</code> and drag Smart Job Seeker into Applications.</li>
			<li>
				Open it from Applications. macOS says it cannot verify the app: click <strong>Done</strong>.
			</li>
			<li>
				Open <strong>System Settings &rarr; Privacy &amp; Security</strong>, scroll down, click
				<strong>Open Anyway</strong> next to Smart Job Seeker, and confirm with your password.
			</li>
			<li>
				If macOS asks to let it control your computer (Accessibility), you can allow it: typing then
				looks like a person's. The app works without it. After an update macOS may ask again.
			</li>
		</ol>
	{:else}
		<ol class="list-decimal space-y-0.5 pl-4">
			<li>
				AppImage: make it executable (<code>chmod +x</code> or the file's Properties) and run it. On
				Ubuntu 22.04 and newer it first needs <code>sudo apt install libfuse2</code>.
			</li>
			<li>
				The AppImage updates itself. The <code>.deb</code> and <code>.rpm</code> do not, so you install
				each new version by hand.
			</li>
		</ol>
	{/if}
	<p class="mt-1.5">
		On first launch the app downloads its own copy of Chrome (about 175 MB), once.
	</p>
</div>
