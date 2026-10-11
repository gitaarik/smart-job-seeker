/**
 * The tailoring review's provider/model pair, as loadConfig resolves it from
 * the environment. See config.llmTailorProvider.
 */
import { describe, expect, it, vi } from 'vitest';

/**
 * A fresh config read from `env`. getEnv is mocked for the whole suite
 * (vitest.setup.ts), so the environment is swapped there rather than in
 * process.env, and the module re-imported so loadConfig runs again.
 */
async function loadWith(env: Record<string, string>) {
	vi.resetModules();
	vi.doMock('$lib/tools/get-env', () => ({
		getEnv: (key: string, fallback = '') => env[key] ?? fallback
	}));
	return (await import('../config')).config;
}

const UNSET = { SJS_LLM_TAILOR_PROVIDER: '', SJS_LLM_TAILOR_MODEL: '' };

describe('the tailoring review pair', () => {
	it('is Gemini 3.8 Flash when there is a Gemini key', async () => {
		const config = await loadWith({
			...UNSET,
			SJS_LLM_PROVIDER: 'groq',
			SJS_LLM_API_KEY_GEMINI: 'key'
		});
		expect([config.llmTailorProvider, config.llmTailorModel]).toEqual([
			'gemini',
			'gemini-3.8-flash'
		]);
	});

	it('is the app pair without one, rather than a provider every review would fail on', async () => {
		const config = await loadWith({
			...UNSET,
			SJS_LLM_PROVIDER: 'groq',
			SJS_LLM_API_KEY_GEMINI: ''
		});
		expect([config.llmTailorProvider, config.llmTailorModel]).toEqual(['groq', config.llmModel]);
	});

	it('takes the pair the environment names', async () => {
		const config = await loadWith({
			SJS_LLM_PROVIDER: 'groq',
			SJS_LLM_API_KEY_GEMINI: 'key',
			SJS_LLM_TAILOR_PROVIDER: 'gemini',
			SJS_LLM_TAILOR_MODEL: 'gemini-2.5-pro'
		});
		expect([config.llmTailorProvider, config.llmTailorModel]).toEqual(['gemini', 'gemini-2.5-pro']);
	});
});
