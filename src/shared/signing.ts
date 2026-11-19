const SIGNING_KEYS = [
  'APPLE_ID',
  'APPLE_APP_SPECIFIC_PASSWORD',
  'APPLE_TEAM_ID',
  'CSC_LINK',
  'CSC_KEY_PASSWORD'
] as const

export function signingEnabled(env: Record<string, string | undefined>): boolean {
  return SIGNING_KEYS.every((key) => (env[key] ?? '').trim().length > 0)
}
