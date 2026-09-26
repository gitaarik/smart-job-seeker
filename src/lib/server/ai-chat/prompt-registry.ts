/**
 * Every prompt template as a versioned prompt in Langfuse (planning/LANGFUSE.md
 * § Prompt registry), so each generation links to the version it ran, and a
 * prompt's metrics, the Playground and experiments work per version.
 *
 * Git holds the text; Langfuse holds every version that has run. A version is
 * found by its label, `fp-<fingerprint>`: the fingerprint `ai_chats`, the
 * llm:smoke record and the golden baselines already carry. Registering compares
 * before it creates, because Langfuse never dedupes and every create is a new
 * version.
 *
 * Who creates. On dev, the first process to use a template nobody registered
 * yet, since dev runs uncommitted edits. Everywhere else the release does,
 * before anything is deployed (cloud scripts/register-prompts.ts), so a box only
 * reads. Each process also moves its environment's label (`development`,
 * `preview`, `production`) onto the version it runs, which is how Langfuse shows
 * what runs where. Nothing fetches by those labels.
 *
 * Two processes registering the same new version at the same moment make two
 * versions, and the calls of each link to the one it made. Only dev creates at
 * runtime, where that is rare and harmless.
 *
 * Without Langfuse keys nothing is resolved and nothing is sent.
 */

import { createHash } from 'node:crypto';
import { LangfuseClient } from '@langfuse/client';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import { getSchemaForPrompt } from '$lib/server/schemas/ai-prompt-schemas';
import { getEnvironmentName } from '$lib/server/monitoring/sentry';
import { runningVersion, sendsToLangfuse } from '$lib/server/monitoring/telemetry';
import { DEFAULT_TEMPERATURE, promptTemplates, type PromptTemplate } from './prompt-templates';
import { promptFingerprint } from './prompt-fingerprint';

/** A template, and the version of it that a call rendered. */
export interface PromptRef {
	key: string;
	fingerprint: string;
}

/** A version in Langfuse, as a generation links to it. */
export interface PromptLink {
	name: string;
	version: number;
}

/**
 * The template a call rendered, when `key` names one: the version its caller
 * says it ran, which for a generation replayed from an `ai_chats` row is the one
 * the row recorded, and otherwise the template as it is now.
 */
export function promptRef(key: string | undefined, fingerprint?: string | null): PromptRef | null {
	const template = templateFor(key);
	if (!key || !template) return null;
	return { key, fingerprint: fingerprint ?? promptFingerprint(template) };
}

/** Own keys only: `constructor` is not a template. */
function templateFor(key: string | undefined): PromptTemplate | null {
	return key && Object.hasOwn(promptTemplates, key) ? promptTemplates[key] : null;
}

/** A version as the registry reads it back. */
export interface RegisteredVersion {
	version: number;
	labels: string[];
	config: unknown;
}

export interface NewVersion {
	name: string;
	messages: { role: 'system' | 'user'; content: string }[];
	config: PromptConfig;
	labels: string[];
	commitMessage: string;
}

/** What the registry needs of Langfuse's prompt API. */
export interface PromptApi {
	/** The version carrying `label`, or null when none does. */
	find(name: string, label: string): Promise<RegisteredVersion | null>;
	create(version: NewVersion): Promise<RegisteredVersion>;
	/** Give a version exactly these labels, taking each from any version that had it. */
	setLabels(name: string, version: number, labels: string[]): Promise<void>;
}

/**
 * What a version carries beside its messages, under the key names Langfuse's
 * Playground reads (`temperature`, `response_format`).
 */
export interface PromptConfig {
	fingerprint: string;
	temperature: number;
	response_format?: {
		type: 'json_schema';
		json_schema: { name: string; schema: Record<string, unknown>; strict: false };
	};
	/**
	 * A hash of the rest. The fingerprint covers the text and the temperature
	 * but not the response schema, which lives in ai-prompt-schemas.ts, so this
	 * is how a schema edit on its own becomes a version too.
	 */
	config_hash: string;
}

function promptConfig(key: string, template: PromptTemplate, fingerprint: string): PromptConfig {
	const schema = responseSchema(key);
	const config = {
		fingerprint,
		temperature: template.temperature ?? DEFAULT_TEMPERATURE,
		...(schema
			? {
					response_format: {
						type: 'json_schema' as const,
						json_schema: { name: key, schema, strict: false as const }
					}
				}
			: {})
	};
	return { ...config, config_hash: hash(canonicalJson(config)) };
}

/**
 * The template's response schema as JSON Schema, converted as LangChain does
 * for a structured call. Null for a prompt that answers in text, and for a
 * schema with a transform in it (extract_job_data's salary coercion), which
 * JSON Schema cannot express.
 */
function responseSchema(key: string): Record<string, unknown> | null {
	const schema = getSchemaForPrompt(key);
	if (!schema) return null;
	try {
		return toJsonSchema(schema) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function hash(text: string): string {
	return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** JSON with every object's keys sorted, so equal values hash equal. */
function canonicalJson(value: unknown): string {
	return JSON.stringify(value, (_key, inner: unknown) =>
		inner && typeof inner === 'object' && !Array.isArray(inner)
			? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
			: inner
	);
}

function configHashOf(config: unknown): string | undefined {
	return config && typeof config === 'object' && 'config_hash' in config
		? String(config.config_hash)
		: undefined;
}

export interface RegistryOptions {
	/** Whether a missing version may be created here, or only read. */
	create: boolean;
	/** The label to move onto each version this process resolves, or null. */
	environmentLabel: string | null;
	/** Why a version was created, as its commit message. */
	commitMessage: string;
}

/** A miss or a failure is not asked about again for this long. */
const RETRY_AFTER_MS = 5 * 60_000;

export class PromptRegistry {
	private readonly resolved = new Map<string, Promise<PromptLink | null>>();

	constructor(
		private readonly api: PromptApi,
		private readonly options: RegistryOptions
	) {}

	/**
	 * The version `ref` names, registered first when it is missing and this
	 * process may register it. Asked once per process; never rejects.
	 */
	resolve(ref: PromptRef): Promise<PromptLink | null> {
		const cacheKey = `${ref.key}@${ref.fingerprint}`;
		let pending = this.resolved.get(cacheKey);
		if (!pending) {
			pending = this.register(ref).then(
				({ link }) => {
					if (!link) this.forgetLater(cacheKey);
					return link;
				},
				(error: unknown) => {
					console.warn(
						`[prompt registry] ${ref.key}: ${error instanceof Error ? error.message : String(error)}`
					);
					this.forgetLater(cacheKey);
					return null;
				}
			);
			this.resolved.set(cacheKey, pending);
		}
		return pending;
	}

	private forgetLater(cacheKey: string): void {
		setTimeout(() => this.resolved.delete(cacheKey), RETRY_AFTER_MS).unref();
	}

	/**
	 * Find the version `ref` names, create it when it is missing and this
	 * process may, and move the environment's label onto it. Only the version in
	 * the tree can be created: an older one's text is in git history, not here.
	 */
	async register(ref: PromptRef): Promise<{ link: PromptLink | null; created: boolean }> {
		const template = templateFor(ref.key);
		const current = template && promptFingerprint(template) === ref.fingerprint ? template : null;
		const label = `fp-${ref.fingerprint}`;
		const config = current ? promptConfig(ref.key, current, ref.fingerprint) : null;

		let found = await this.api.find(ref.key, label);
		// The same text under another schema: a version of its own, which takes
		// the label over. A box that may not create links to the text it ran.
		if (
			found &&
			config &&
			this.options.create &&
			configHashOf(found.config) !== config.config_hash
		) {
			found = null;
		}

		let created = false;
		if (!found) {
			if (!current || !config || !this.options.create) return { link: null, created };
			found = await this.api.create({
				name: ref.key,
				messages: [
					{ role: 'system', content: current.system_prompt },
					{ role: 'user', content: current.user_prompt }
				],
				config,
				labels: [label, ...(this.options.environmentLabel ? [this.options.environmentLabel] : [])],
				commitMessage: this.options.commitMessage
			});
			created = true;
		}

		const environment = this.options.environmentLabel;
		if (environment && !found.labels.includes(environment)) {
			// Only what the dashboard shows; the link stands without it.
			await this.api
				.setLabels(ref.key, found.version, [
					...found.labels.filter((existing) => existing !== 'latest'),
					environment
				])
				.catch((error: unknown) =>
					console.warn(
						`[prompt registry] ${ref.key}: could not label version ${found.version} ${environment}: ${
							error instanceof Error ? error.message : String(error)
						}`
					)
				);
		}
		return { link: { name: ref.key, version: found.version }, created };
	}
}

/** Kept short: a generation waits on the answer, briefly, before it ends. */
const REQUEST_TIMEOUT_S = 5;

/** Langfuse's prompt API, through its client, or null without keys. */
function langfusePromptApi(): PromptApi | null {
	const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
	const secretKey = process.env.LANGFUSE_SECRET_KEY;
	if (!publicKey || !secretKey) return null;

	const { api } = new LangfuseClient({
		publicKey,
		secretKey,
		baseUrl: process.env.LANGFUSE_BASE_URL || undefined,
		timeout: REQUEST_TIMEOUT_S
	});
	const requestOptions = { maxRetries: 1, timeoutInSeconds: REQUEST_TIMEOUT_S };
	const read = (prompt: { version: number; labels: string[]; config?: unknown }) => ({
		version: prompt.version,
		labels: prompt.labels,
		config: prompt.config
	});

	return {
		async find(name, label) {
			try {
				return read(await api.prompts.get(name, { label }, requestOptions));
			} catch (error) {
				if ((error as { statusCode?: number }).statusCode === 404) return null;
				throw error;
			}
		},
		async create({ name, messages, config, labels, commitMessage }) {
			const created = await api.prompts.create(
				{ name, type: 'chat', prompt: messages, config, labels, commitMessage },
				requestOptions
			);
			return read(created);
		},
		async setLabels(name, version, labels) {
			await api.promptVersion.update(name, version, { newLabels: labels }, requestOptions);
		}
	};
}

let processRegistry: PromptRegistry | null = null;

/**
 * The version of a template that a call ran, for its generation to link to.
 * Null when this process sends nothing to Langfuse, and for a version that is
 * not registered where this process may not register it.
 */
export function resolvePrompt(ref: PromptRef): Promise<PromptLink | null> {
	if (!sendsToLangfuse()) return Promise.resolve(null);
	if (!processRegistry) {
		const api = langfusePromptApi();
		if (!api) return Promise.resolve(null);
		const environment = getEnvironmentName();
		processRegistry = new PromptRegistry(api, {
			create: environment === 'development',
			environmentLabel: environment,
			commitMessage: `first use in ${environment}, on ${runningVersion() ?? 'an unknown version'} with local edits`
		});
	}
	return processRegistry.resolve(ref);
}

/**
 * Register every template in the project the environment's keys name, as the
 * release does before a deploy. Moves no environment label: each box moves its
 * own when it first runs a version. Throws on the first failure.
 */
export async function registerAllPrompts(
	commitMessage: string
): Promise<{ created: string[]; existing: string[] }> {
	const api = langfusePromptApi();
	if (!api) throw new Error('LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are not set');
	const registry = new PromptRegistry(api, { create: true, environmentLabel: null, commitMessage });

	const created: string[] = [];
	const existing: string[] = [];
	for (const key of Object.keys(promptTemplates)) {
		const { created: made } = await registry.register(promptRef(key)!);
		(made ? created : existing).push(key);
	}
	return { created, existing };
}
