import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chooseLocale } from './locale'
import { signingEnabled } from './signing'

describe('jsonbranch identity', () => {
  it('chooses Chinese unless the language starts with en', () => {
    expect(chooseLocale('zh-Hans')).toBe('zh')
    expect(chooseLocale('en')).toBe('en')
    expect(chooseLocale('fr')).toBe('zh')
  })

  it('pins the parser and does not sign with a partial secret set', () => {
    expect(readFileSync('packages/json-core/package.json', 'utf8')).toContain('"jsonc-parser": "3.3.1"')
    const full = {
      APPLE_ID: 'a',
      APPLE_APP_SPECIFIC_PASSWORD: 'b',
      APPLE_TEAM_ID: 'c',
      CSC_LINK: 'd',
      CSC_KEY_PASSWORD: 'e'
    }
    expect(signingEnabled(full)).toBe(true)
    expect(signingEnabled({ ...full, CSC_LINK: '' })).toBe(false)
  })

  it('keeps the MIT notice and both Orca URLs', () => {
    expect(readFileSync('LICENSE', 'utf8')).toContain('Copyright (c) 2026 Lovecast Inc.')
    const notice = readFileSync('NOTICE', 'utf8')
    expect(notice).toContain('https://github.com/stablyai/orca')
    expect(notice).toContain('https://github.com/yongwuzhijin/orca')
  })
})
