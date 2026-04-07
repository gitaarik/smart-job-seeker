type GetEnvOptions = { allowEmpty: true };

/**
 * Get an environment variable with fail-fast behavior.
 *
 * @param envVar - The environment variable name
 * @param defaultOrOptions - Either a default value string, or options object
 *
 * @example
 * // Required - throws if not set/empty (most common)
 * getEnv("API_KEY")
 *
 * @example
 * // Optional with default value
 * getEnv("PORT", "3000")
 *
 * @example
 * // Optional without default - allowed to be empty
 * getEnv("OPTIONAL_VAR", { allowEmpty: true })
 */
export function getEnv(
  envVar: string,
  defaultOrOptions?: string | GetEnvOptions,
): string | undefined {
  // Option 1: Default value provided - return env var or default
  if (typeof defaultOrOptions === "string") {
    return process.env[envVar] ?? defaultOrOptions;
  }

  // Option 2: allowEmpty option - return undefined if not set
  if (defaultOrOptions?.allowEmpty) {
    return process.env[envVar] || undefined;
  }

  // Option 3: Required (default behavior) - throw if missing/empty
  const value = process.env[envVar];
  if (!value) {
    // During SvelteKit's postbuild analysis, all server modules are imported
    // to analyse routes. Return a placeholder instead of crashing the build.
    if (process.env.SJS_BUILDING === "true") {
      return `__build_placeholder_${envVar}__`;
    }
    throw new Error(`Environment variable ${envVar} is not set`);
  }
  return value;
}
