/**
 * Error tracking and structured logging
 * Provides a wrapper for capturing errors with context
 * Future: Can be integrated with Sentry or other monitoring services
 */

import { config } from "$lib/server/config";

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
    const logEntry: LogContext = {
      level: "error",
      message,
      error,
      timestamp: new Date(),
      ...context,
    };

    // Console logging for now - can be extended to send to Sentry, etc.
    console.error(
      `[ErrorTracker] ${message}`,
      {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...context,
      },
    );

    // Future: Send to external monitoring service
    // if (process.env.SENTRY_DSN) {
    //   Sentry.captureException(error, { contexts: { custom: context } });
    // }
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
