import * as dotenvx from '@dotenvx/dotenvx'

export function getEnv(envVar: string): string | undefined {
  return dotenvx.get(envVar)
}