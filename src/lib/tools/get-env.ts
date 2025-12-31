import * as dotenvx from "@dotenvx/dotenvx";

export function getEnv(
  envVar: string,
  defaultValue?: string,
): string | undefined {
  // If a default value is provided, use process.env directly to avoid
  // dotenvx warnings about missing optional configuration
  if (defaultValue !== undefined) {
    return process.env[envVar] ?? defaultValue;
  }

  // For required variables (no default), use dotenvx which will warn if missing
  return dotenvx.get(envVar);
}
