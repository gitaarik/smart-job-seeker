import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

// Two test projects so we can run server-side tests in node and Svelte
// component tests in jsdom (the latter need the `browser` resolve condition
// so Svelte's client build, not its server build, is imported).
export default defineConfig({
	plugins: [sveltekit()],
	test: {
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/**',
				'generated/**',
				'.svelte-kit/**',
				'**/*.config.ts',
				'**/*.config.js',
				'**/test-utils/**',
				'**/__tests__/**',
				'**/vitest.setup.ts'
			]
		},
		projects: [
			{
				extends: true,
				test: {
					name: 'server',
					environment: 'node',
					exclude: ['e2e/**', 'node_modules/**', 'src/**/*.svelte.{test,spec}.{js,ts}'],
					setupFiles: ['./vitest.setup.ts'],
					pool: 'forks'
				}
			},
			{
				extends: true,
				resolve: { conditions: ['browser'] },
				test: {
					name: 'client',
					environment: 'jsdom',
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					pool: 'forks'
				}
			}
		]
	}
});
