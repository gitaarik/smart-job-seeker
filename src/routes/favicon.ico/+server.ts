import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Browsers and headless renderers ask for /favicon.ico regardless of the
 * `<link rel="icon">` in app.html. The 404 was more than noise: in dev every
 * miss makes SvelteKit rewrite its generated error template, and vite answers
 * that with a full reload of every open tab — including an edit page mid-save.
 */
export const GET: RequestHandler = () => {
	redirect(302, '/favicon.svg');
};
