/**
 * The contact details of one showcase page, and the Turnstile check that
 * fetches them. One per page, shared by every "Get in touch" button on it.
 */

import type { PortfolioContact } from '$lib/server/profile/portfolio-contact';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface Turnstile {
	render: (el: HTMLElement, options: Record<string, unknown>) => string;
	reset: (widgetId?: string) => void;
}

function turnstile(): Turnstile | undefined {
	return (window as unknown as { turnstile?: Turnstile }).turnstile;
}

let scriptLoad: Promise<void> | null = null;

/** Load Cloudflare's script once per page, however many widgets ask. */
function loadScript(): Promise<void> {
	if (turnstile()) return Promise.resolve();
	scriptLoad ??= new Promise<void>((resolve, reject) => {
		const script = document.createElement('script');
		script.src = SCRIPT_URL;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => {
			scriptLoad = null;
			reject(new Error('Turnstile script did not load'));
		};
		document.head.appendChild(script);
	});
	return scriptLoad;
}

export class ContactState {
	details = $state<PortfolioContact | null>(null);
	loading = $state(false);
	failed = $state(false);

	#rendered = new WeakSet<HTMLElement>();

	/**
	 * @param endpoint the page's contact route
	 * @param siteKey null when the instance has no Turnstile, and the endpoint answers without a check
	 * @param accessToken a share link's token, which the endpoint asks for as the page did
	 */
	constructor(
		private endpoint: string,
		private siteKey: string | null,
		private accessToken: string | null
	) {}

	/** Put a widget in `el`, or with no Turnstile configured, ask straight away. */
	async challenge(el: HTMLElement, scheme: 'light' | 'dark'): Promise<void> {
		if (this.details || this.#rendered.has(el)) return;
		this.#rendered.add(el);
		this.failed = false;

		if (!this.siteKey) {
			this.loading = true;
			await this.fetchDetails(null);
			return;
		}

		this.loading = true;
		try {
			await loadScript();
		} catch {
			this.loading = false;
			this.failed = true;
			return;
		}
		const widgetId = turnstile()?.render(el, {
			sitekey: this.siteKey,
			theme: scheme,
			callback: async (token: string) => {
				const ok = await this.fetchDetails(token);
				if (!ok) turnstile()?.reset(widgetId);
			},
			'error-callback': () => {
				this.failed = true;
			},
			'unsupported-callback': () => {
				this.failed = true;
			}
		});
		this.loading = false;
	}

	private async fetchDetails(turnstileToken: string | null): Promise<boolean> {
		try {
			const res = await fetch(this.endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ turnstileToken, accessToken: this.accessToken })
			});
			if (!res.ok) throw new Error(`contact endpoint answered ${res.status}`);
			this.details = (await res.json()) as PortfolioContact;
			return true;
		} catch (err) {
			console.error('[portfolio] contact details:', err);
			this.failed = true;
			return false;
		} finally {
			this.loading = false;
		}
	}
}
