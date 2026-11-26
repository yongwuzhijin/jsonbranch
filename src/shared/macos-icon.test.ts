import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const icon1024 = '0c93956a4fa065f1c0003119a344379760ed753eb641e9ad391837739353408b'
const icon2048 = '1eb4e1c19c79d16540b300adda0c95e317c6531423050269b66e0967692f18f2'

describe('macos app icon', () => {
  it('points electron-builder at the full-bleed 1024 icon and keeps the 2048 source beside it', () => {
    const builder = readFileSync('electron-builder.yml', 'utf8')
    expect(builder).toMatch(/^ {2}icon: build\/icon\.png$/m)
    expect(sha256('build/icon.png')).toBe(icon1024)
    expect(sha256('build/icon-2048.png')).toBe(icon2048)
  })
})

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}
