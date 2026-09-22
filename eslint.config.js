import prettier from 'eslint-config-prettier';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default ts.config(
	includeIgnoreFile(gitignorePath),
	// noVNC, vendored wholesale for the tunnel VNC viewer. It is third-party
	// code we do not edit, and linting it only ever reports other people's
	// style choices back at us.
	{ ignores: ['static/vnc/**'] },
	// A disable directive that stops being necessary is worse than none: it
	// sits there silently covering whatever the next person writes on that
	// line. Make the stale one an error so it has to be removed.
	{ linterOptions: { reportUnusedDisableDirectives: 'error' } },
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',

			// Honour the leading underscore, which this codebase already writes and
			// the rule's defaults do not recognise. The OSS billing stubs are the
			// clearest case: `requireCredits(_userId, _estimatedCost)` names the
			// arguments the cloud overlay uses so the signatures match, and ignores
			// them because everything is free here — 21 errors for saying that
			// deliberately. It also makes `const { [key]: _, ...rest }` usable for
			// omitting a property, which had to be written as copy-then-delete.
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_'
				}
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	}
);
