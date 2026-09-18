/**
 * Error tracking and structured logging
 * Provides a wrapper for capturing errors with context
 * Integrates with Sentry/GlitchTip when SENTRY_DSN is configured
 */

import { config } from '$lib/server/config';
import { Sentry } from './sentry';

export interface ErrorContext {
	userId?: string;
	requestId?: string;
	operation?: string;
	metadata?: Record<string, unknown>;
}

export interface LogContext extends ErrorContext {
	level: 'info' | 'warn' | 'error' | 'debug';
	message: string;
	error?: Error;
	timestamp?: Date;
}

/** The console method and prefix each level has always used. */
const CONSOLE: Record<
	LogContext['level'],
	{ write: (...args: unknown[]) => void; prefix: string }
> = {
	error: { write: (...a) => console.error(...a), prefix: '[ErrorTracker]' },
	warn: { write: (...a) => console.warn(...a), prefix: '[Warning]' },
	info: { write: (...a) => console.log(...a), prefix: '[Info]' },
	debug: { write: (...a) => console.debug(...a), prefix: '[Debug]' }
};

/** Sentry's breadcrumb levels, which are not spelled quite like ours. */
const BREADCRUMB_LEVEL = {
	error: 'error',
	warn: 'warning',
	info: 'info',
	debug: 'debug'
} as const;

class ErrorTracker {
	/**
	 * Where a log entry becomes output, for every level.
	 *
	 * `LogContext` was declared above and never built: each method shaped its
	 * own console call, and only `logError` knew Sentry existed. So on a box
	 * with a DSN configured, a warning reached the container log and nothing a
	 * person looks at.
	 *
	 * Warnings, info and debug leave a BREADCRUMB rather than an event, which
	 * is the weight they want. `withRetry` logs one warning per attempt, so a
	 * provider having a bad hour would be a page of issues as events; as
	 * breadcrumbs the attempts and their delays sit under the "all retry
	 * attempts exhausted" error that follows them, which is the entry somebody
	 * actually opens and the one thing it could never say before.
	 */
	private emit({ level, message, error, timestamp, ...context }: LogContext): void {
		const { write, prefix } = CONSOLE[level];
		write(
			`${prefix} ${message}`,
			error ? { name: error.name, message: error.message, stack: error.stack, ...context } : context
		);

		if (!process.env.SENTRY_DSN) return;

		if (error) {
			Sentry.captureException(error, {
				contexts: { custom: context as Record<string, unknown> }
			});
			return;
		}

		Sentry.addBreadcrumb({
			level: BREADCRUMB_LEVEL[level],
			message,
			// Sentry counts breadcrumb time in seconds, not milliseconds.
			timestamp: (timestamp ?? new Date()).getTime() / 1000,
			data: context as Record<string, unknown>
		});
	}

	/**
	 * Log an error with structured context
	 */
	logError(message: string, error: Error, context?: ErrorContext): void {
		// Errors thrown inside a scraper `step()` carry a `sjsStep` decoration
		// (runId / stepId / parent / name). Pull it into the context so it
		// shows up in Sentry/GlitchTip extras and the console log.
		const stepInfo = (error as Error & { sjsStep?: Record<string, unknown> }).sjsStep;
		const enrichedContext: ErrorContext | undefined = stepInfo
			? {
					...(context ?? {}),
					metadata: {
						...(context?.metadata ?? {}),
						sjsStep: stepInfo
					}
				}
			: context;

		this.emit({ level: 'error', message, error, ...enrichedContext });
	}

	/**
	 * Log a warning
	 */
	logWarning(message: string, context?: ErrorContext): void {
		this.emit({ level: 'warn', message, ...context });
	}

	/**
	 * Log info message
	 */
	logInfo(message: string, context?: ErrorContext): void {
		this.emit({ level: 'info', message, ...context });
	}

	/**
	 * Log debug message (only in development)
	 */
	logDebug(message: string, context?: ErrorContext): void {
		if (!config.isProduction) {
			this.emit({ level: 'debug', message, ...context });
		}
	}

	/**
	 * Wrap an async function with error tracking
	 */
	async trackOperation<T>(
		operation: string,
		fn: () => Promise<T>,
		context?: ErrorContext
	): Promise<T> {
		try {
			this.logDebug(`Starting operation: ${operation}`, context);
			const result = await fn();
			this.logDebug(`Completed operation: ${operation}`, context);
			return result;
		} catch (error) {
			this.logError(
				`Operation failed: ${operation}`,
				error instanceof Error ? error : new Error(String(error)),
				{ ...context, operation }
			);
			throw error;
		}
	}
}

// Export singleton instance
export const errorTracker = new ErrorTracker();
