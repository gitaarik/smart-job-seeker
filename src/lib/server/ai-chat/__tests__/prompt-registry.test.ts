/**
 * The prompt registry's promises (planning/LANGFUSE.md § Prompt registry),
 * against an in-memory stand-in for Langfuse's prompt API that behaves as the
 * real one does: every create is a new version, and a label belongs to one
 * version at a time.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TEMPERATURE, promptTemplates } from '../prompt-templates';
import { promptFingerprint } from '../prompt-fingerprint';
import {
	langfuseVariable,
	promptRef,
	PromptRegistry,
	registeredMessages,
	type NewVersion,
	type PromptApi,
	type RegisteredVersion
} from '../prompt-registry';

interface Stored extends RegisteredVersion {
	name: string;
	messages: NewVersion['messages'];
}

class FakePromptApi implements PromptApi {
	readonly versions: Stored[] = [];
	readonly calls = { find: 0, create: 0, setLabels: 0 };

	async find(name: string, label: string) {
		this.calls.find++;
		const found = this.versions.find((v) => v.name === name && v.labels.includes(label));
		return found
			? { version: found.version, labels: [...found.labels], config: found.config }
			: null;
	}

	async create({ name, messages, config, labels }: NewVersion) {
		this.calls.create++;
		const taken = [...labels, 'latest'];
		for (const v of this.versions) {
			if (v.name === name) v.labels = v.labels.filter((l) => !taken.includes(l));
		}
		const version = this.versions.filter((v) => v.name === name).length + 1;
		this.versions.push({ name, version, labels: taken, config, messages });
		return { version, labels: [...taken], config };
	}

	async setLabels(name: string, version: number, labels: string[]) {
		this.calls.setLabels++;
		for (const v of this.versions) {
			if (v.name !== name) continue;
			v.labels =
				v.version === version
					? [...labels, ...(v.labels.includes('latest') ? ['latest'] : [])]
					: v.labels.filter((l) => !labels.includes(l));
		}
	}
}

const KEY = 'score_job_match';
const current = () => promptRef(KEY)!;
const dev = { create: true, environmentLabel: 'development', commitMessage: 'test' };

afterEach(() => {
	vi.useRealTimers();
});

describe('promptRef', () => {
	it('names a template, as it is now unless the caller says which version ran', () => {
		expect(current()).toEqual({ key: KEY, fingerprint: promptFingerprint(promptTemplates[KEY]) });
		expect(promptRef(KEY, 'abcdef0123456789')).toEqual({
			key: KEY,
			fingerprint: 'abcdef0123456789'
		});
	});

	it('names nothing for an inline prompt, or a key that is only an object property', () => {
		expect(promptRef('login_block_cause')).toBeNull();
		expect(promptRef('constructor')).toBeNull();
		expect(promptRef(undefined)).toBeNull();
	});
});

describe('registeredMessages', () => {
	// Langfuse's own rule (packages/shared/src/utils/stringChecks.ts): filling a
	// prompt from a dataset item, it skips a variable whose name breaks it.
	const LANGFUSE_VARIABLE = /^\p{L}[\p{L}\p{N}_]*$/u;
	const variablesIn = (text: string) => [...text.matchAll(/\{\{([^{}]+)\}\}/g)].map((m) => m[1]);

	it('names every variable of every template as Langfuse fills it, the text otherwise as it is', () => {
		for (const [key, template] of Object.entries(promptTemplates)) {
			const messages = registeredMessages(template);
			for (const message of messages) {
				for (const name of variablesIn(message.content)) {
					expect(name, `${key}: {{${name}}}`).toMatch(LANGFUSE_VARIABLE);
				}
			}
			const unnamed = (text: string) => text.replace(/\{\{[^{}]+\}\}/g, '{{}}');
			expect(unnamed(messages[0].content)).toBe(unnamed(template.system_prompt));
			expect(unnamed(messages[1].content)).toBe(unnamed(template.user_prompt));
		}
	});

	it("never gives two of a template's variables the same name", () => {
		for (const [key, template] of Object.entries(promptTemplates)) {
			const names = new Set(
				variablesIn(template.system_prompt + template.user_prompt).map((name) => name.trim())
			);
			const renamed = new Set([...names].map(langfuseVariable));
			expect(renamed.size, key).toBe(names.size);
		}
	});

	it("writes the matcher's dotted variables with underscores", () => {
		const [, user] = registeredMessages(promptTemplates[KEY]);
		expect(user.content).toContain('{{job_title}}');
		expect(user.content).not.toContain('{{job.title}}');
	});
});

describe('PromptRegistry', () => {
	it('registers a missing version once, under its fingerprint label, and reads it after', async () => {
		const api = new FakePromptApi();
		const registry = new PromptRegistry(api, dev);

		const [first, second] = await Promise.all([
			registry.resolve(current()),
			registry.resolve(current())
		]);
		await registry.resolve(current());

		expect(first).toEqual({ name: KEY, version: 1 });
		expect(second).toEqual(first);
		expect(api.calls).toEqual({ find: 1, create: 1, setLabels: 0 });
		const [stored] = api.versions;
		expect(stored.labels).toEqual([`fp-${current().fingerprint}`, 'development', 'latest']);
		expect(stored.messages).toEqual(registeredMessages(promptTemplates[KEY]));
		expect(stored.config).toMatchObject({
			fingerprint: current().fingerprint,
			temperature: promptTemplates[KEY].temperature ?? DEFAULT_TEMPERATURE,
			response_format: { type: 'json_schema', json_schema: { name: KEY, strict: false } }
		});
	});

	it('creates nothing on a second pass', async () => {
		const api = new FakePromptApi();
		await new PromptRegistry(api, dev).register(current());
		const again = await new PromptRegistry(api, dev).register(current());

		expect(again).toEqual({ link: { name: KEY, version: 1 }, created: false });
		expect(api.calls.create).toBe(1);
	});

	it("moves a box's environment label onto the version it runs, once", async () => {
		const api = new FakePromptApi();
		await new PromptRegistry(api, { ...dev, environmentLabel: null }).register(current());

		const preview = new PromptRegistry(api, { ...dev, create: false, environmentLabel: 'preview' });
		await preview.resolve(current());
		await preview.resolve(current());

		expect(api.calls.setLabels).toBe(1);
		expect(api.versions[0].labels).toContain('preview');
		expect(api.versions[0].labels).toContain(`fp-${current().fingerprint}`);
	});

	it('links nothing on a box that may not register a missing version', async () => {
		const api = new FakePromptApi();
		const link = await new PromptRegistry(api, { ...dev, create: false }).resolve(current());

		expect(link).toBeNull();
		expect(api.calls.create).toBe(0);
	});

	it('finds an older version but never creates one, whose text is not in the tree', async () => {
		const api = new FakePromptApi();
		const older = promptRef(KEY, '0000000000000000')!;

		expect(await new PromptRegistry(api, dev).resolve(older)).toBeNull();
		expect(api.calls.create).toBe(0);
	});

	it('gives a schema edit on its own a version of its own on dev, and links the text elsewhere', async () => {
		const api = new FakePromptApi();
		await new PromptRegistry(api, dev).register(current());
		api.versions[0].config = {
			...(api.versions[0].config as object),
			config_hash: 'an older schema'
		};

		const onBox = await new PromptRegistry(api, { ...dev, create: false }).resolve(current());
		expect(onBox).toEqual({ name: KEY, version: 1 });

		const onDev = await new PromptRegistry(api, dev).resolve(current());
		expect(onDev).toEqual({ name: KEY, version: 2 });
		expect(api.versions[0].labels).not.toContain(`fp-${current().fingerprint}`);
	});

	it('links nothing when Langfuse cannot be reached, and asks again later', async () => {
		vi.useFakeTimers();
		const api = new FakePromptApi();
		const find = vi.spyOn(api, 'find').mockRejectedValueOnce(new Error('ECONNRESET'));
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const registry = new PromptRegistry(api, dev);

		expect(await registry.resolve(current())).toBeNull();
		expect(await registry.resolve(current())).toBeNull();
		expect(find).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(5 * 60_000);
		expect(await registry.resolve(current())).toEqual({ name: KEY, version: 1 });
		expect(find).toHaveBeenCalledTimes(2);
		warn.mockRestore();
	});

	it('still links when moving the environment label fails', async () => {
		const api = new FakePromptApi();
		await new PromptRegistry(api, { ...dev, environmentLabel: null }).register(current());
		vi.spyOn(api, 'setLabels').mockRejectedValueOnce(new Error('403'));
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const link = await new PromptRegistry(api, { ...dev, environmentLabel: 'production' }).resolve(
			current()
		);

		expect(link).toEqual({ name: KEY, version: 1 });
		warn.mockRestore();
	});
});
