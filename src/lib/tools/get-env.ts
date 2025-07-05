import * as dotenvx from '@dotenvx/dotenvx'

export function getEnv(envVar: string, defaultValue?: string): string | undefined {
  return dotenvx.get(envVar) ?? defaultValue
}