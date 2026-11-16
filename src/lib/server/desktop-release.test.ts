import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	getDesktopDownloads,
	pickDesktopDownloads,
	resetDesktopDownloadsCache
} from './desktop-release';

// The v0.4.2 release's real asset list.
const V042 = [
	'latest.json',
	'Smart.Job.Seeker-0.4.2-1.x86_64.rpm',
	'Smart.Job.Seeker-0.4.2-1.x86_64.rpm.sig',
	'Smart.Job.Seeker_0.4.2_aarch64.dmg',
	'Smart.Job.Seeker_0.4.2_amd64.AppImage',
	'Smart.Job.Seeker_0.4.2_amd64.AppImage.sig',
	'Smart.Job.Seeker_0.4.2_amd64.deb',
	'Smart.Job.Seeker_0.4.2_amd64.deb.sig',
	'Smart.Job.Seeker_0.4.2_x64-setup.exe',
	'Smart.Job.Seeker_0.4.2_x64-setup.exe.sig',
	'Smart.Job.Seeker_0.4.2_x64.dmg',
	'Smart.Job.Seeker_0.4.2_x64_en-US.msi',
	'Smart.Job.Seeker_0.4.2_x64_en-US.msi.sig',
	'Smart.Job.Seeker_aarch64.app.tar.gz',
	'Smart.Job.Seeker_aarch64.app.tar.gz.sig',
	'Smart.Job.Seeker_x64.app.tar.gz',
	'Smart.Job.Seeker_x64.app.tar.gz.sig'
].map((name) => ({ name, browser_download_url: `https://dl.example/${name}`, size: 1 }));

describe('pickDesktopDownloads', () => {
	it('picks one installer per kind and never a signature or updater archive', () => {
		const d = pickDesktopDownloads('v0.4.2', V042);
		expect(d.version).toBe('0.4.2');
		expect(d.macArm?.name).toBe('Smart.Job.Seeker_0.4.2_aarch64.dmg');
		expect(d.macIntel?.name).toBe('Smart.Job.Seeker_0.4.2_x64.dmg');
		expect(d.windowsExe?.name).toBe('Smart.Job.Seeker_0.4.2_x64-setup.exe');
		expect(d.windowsMsi?.name).toBe('Smart.Job.Seeker_0.4.2_x64_en-US.msi');
		expect(d.linuxAppImage?.name).toBe('Smart.Job.Seeker_0.4.2_amd64.AppImage');
		expect(d.linuxDeb?.name).toBe('Smart.Job.Seeker_0.4.2_amd64.deb');
		expect(d.linuxRpm?.name).toBe('Smart.Job.Seeker-0.4.2-1.x86_64.rpm');
	});

	it('leaves a missing kind null, as on a prerelease without MSI or RPM', () => {
		const d = pickDesktopDownloads(
			'v0.4.3-beta.4',
			V042.filter((a) => !a.name.includes('.msi') && !a.name.includes('.rpm'))
		);
		expect(d.windowsMsi).toBeNull();
		expect(d.linuxRpm).toBeNull();
		expect(d.windowsExe).not.toBeNull();
	});
});

describe('getDesktopDownloads', () => {
	afterEach(() => resetDesktopDownloadsCache());

	it('caches a successful lookup', async () => {
		const fetchFn = vi.fn(
			async () => new Response(JSON.stringify({ tag_name: 'v0.4.2', assets: V042 }))
		);
		const a = await getDesktopDownloads(fetchFn as unknown as typeof fetch);
		const b = await getDesktopDownloads(fetchFn as unknown as typeof fetch);
		expect(a.windowsExe).not.toBeNull();
		expect(b).toBe(a);
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});

	it('returns no installers instead of throwing when GitHub fails', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const fetchFn = vi.fn(async () => new Response('rate limited', { status: 403 }));
		const d = await getDesktopDownloads(fetchFn as unknown as typeof fetch);
		expect(d.version).toBeNull();
		expect(d.windowsExe).toBeNull();
	});
});
