/**
 * The desktop app's installers, per OS, from its latest stable GitHub release.
 *
 * Tauri puts the version in every installer's file name
 * (`Smart.Job.Seeker_0.4.2_x64-setup.exe`), so there is no fixed
 * `releases/latest/download/<name>` URL to link to. Without this, every
 * download link went to one release page of 17 assets, `.sig` files and
 * updater archives included, and a stranger had to pick the right one
 * (GO-LIVE.md §1, the 2026-11-13 stranger walk).
 *
 * `releases/latest` is the newest release GitHub does not mark as a
 * prerelease, which is also what the stable updater channel serves, so the
 * page and the auto-updater agree on the version.
 */

export const DESKTOP_REPO = 'gitaarik/sjs-desktop';
export const DESKTOP_RELEASES_URL = `https://github.com/${DESKTOP_REPO}/releases/latest`;

export interface DesktopDownload {
	name: string;
	url: string;
	size: number;
}

export interface DesktopDownloads {
	version: string | null;
	macArm: DesktopDownload | null;
	macIntel: DesktopDownload | null;
	windowsExe: DesktopDownload | null;
	windowsMsi: DesktopDownload | null;
	linuxAppImage: DesktopDownload | null;
	linuxDeb: DesktopDownload | null;
	linuxRpm: DesktopDownload | null;
}

interface GithubAsset {
	name: string;
	browser_download_url: string;
	size: number;
}

const EMPTY: DesktopDownloads = {
	version: null,
	macArm: null,
	macIntel: null,
	windowsExe: null,
	windowsMsi: null,
	linuxAppImage: null,
	linuxDeb: null,
	linuxRpm: null
};

/** Picks each installer by its suffix; `.sig` files and the updater's `.app.tar.gz` never match. */
export function pickDesktopDownloads(
	tagName: string | null,
	assets: GithubAsset[]
): DesktopDownloads {
	const find = (suffix: string): DesktopDownload | null => {
		const asset = assets.find((a) => a.name.endsWith(suffix));
		return asset ? { name: asset.name, url: asset.browser_download_url, size: asset.size } : null;
	};
	return {
		version: tagName ? tagName.replace(/^v/, '') : null,
		macArm: find('_aarch64.dmg'),
		macIntel: find('_x64.dmg'),
		windowsExe: find('_x64-setup.exe'),
		windowsMsi: find('.msi'),
		linuxAppImage: find('.AppImage'),
		linuxDeb: find('.deb'),
		linuxRpm: find('.rpm')
	};
}

// An hour is far inside GitHub's 60 unauthenticated requests an hour per IP,
// and a new release reaching this page an hour late costs nothing.
const TTL_MS = 60 * 60 * 1000;
// A failed lookup is retried sooner, so a GitHub blip does not leave the
// page on the fallback links for an hour.
const FAILURE_TTL_MS = 5 * 60 * 1000;

let cached: { value: DesktopDownloads; expires: number } | null = null;
let inflight: Promise<DesktopDownloads> | null = null;

/**
 * Never throws. On any failure it returns no installers, and the page falls
 * back to linking the release page, which is what it did before.
 */
export async function getDesktopDownloads(
	fetchFn: typeof fetch = fetch
): Promise<DesktopDownloads> {
	if (cached && cached.expires > Date.now()) return cached.value;
	if (inflight) return inflight;
	inflight = (async () => {
		try {
			const res = await fetchFn(`https://api.github.com/repos/${DESKTOP_REPO}/releases/latest`, {
				headers: {
					Accept: 'application/vnd.github+json',
					'User-Agent': 'smart-job-seeker'
				},
				signal: AbortSignal.timeout(3000)
			});
			if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
			const body = (await res.json()) as { tag_name?: string; assets?: GithubAsset[] };
			const value = pickDesktopDownloads(body.tag_name ?? null, body.assets ?? []);
			cached = { value, expires: Date.now() + TTL_MS };
			return value;
		} catch (err) {
			console.warn('[desktop-release] latest release lookup failed:', err);
			cached = { value: EMPTY, expires: Date.now() + FAILURE_TTL_MS };
			return EMPTY;
		} finally {
			inflight = null;
		}
	})();
	return inflight;
}

/** For tests. */
export function resetDesktopDownloadsCache(): void {
	cached = null;
	inflight = null;
}
