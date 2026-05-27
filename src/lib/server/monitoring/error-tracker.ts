/**
 * Error tracking and structured logging
 * Provides a wrapper for capturing errors with context
 * Integrates with Sentry/GlitchTip when SENTRY_DSN is configured
 */

import { config } from "$lib/server/config";
import { Sentry } from "./sentry";

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

export interface LogContext extends ErrorContext {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  error?: Error;
  timestamp?: Date;
}

class ErrorTracker {
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
          sjsStep: stepInfo,
        },
      }
      : context;

    const logEntry: LogContext = {
      level: "error",
      message,
      error,
      timestamp: new Date(),
      ...enrichedContext,
    };

    console.error(
      `[ErrorTracker] ${message}`,
      {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...enrichedContext,
      },
    );

    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        contexts: { custom: enrichedContext as Record<string, unknown> },
      });
    }
  }

  /**
   * Log a warning
   */
  logWarning(message: string, context?: ErrorContext): void {
    const logEntry: LogContext = {
      level: "warn",
      message,
      timestamp: new Date(),
      ...context,
    };

    console.warn(`[Warning] ${message}`, context);
  }

  /**
   * Log info message
   */
  logInfo(message: string, context?: ErrorContext): void {
    const logEntry: LogContext = {
      level: "info",
      message,
      timestamp: new Date(),
      ...context,
    };

    console.log(`[Info] ${message}`, context);
  }

  /**
   * Log debug message (only in development)
   */
  logDebug(message: string, context?: ErrorContext): void {
    if (!config.isProduction) {
      const logEntry: LogContext = {
        level: "debug",
        message,
        timestamp: new Date(),
        ...context,
      };

      console.debug(`[Debug] ${message}`, context);
    }
  }

  /**
   * Wrap an async function with error tracking
   */
  async trackOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: ErrorContext,
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
        { ...context, operation },
      );
      throw error;
    }
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker();
