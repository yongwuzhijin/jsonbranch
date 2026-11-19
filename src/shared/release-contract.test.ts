import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('jsonbranch release contract', () => {
  it('publishes both mac arches and an unpacked extension zip', () => {
    const builder = readFileSync('electron-builder.yml', 'utf8')
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8')
    const readme = readFileSync('README.md', 'utf8')
    expect(builder).toContain('appId: app.jsonbranch.macos')
    expect(builder).toContain('JSONBranch-macos-arm64')
    expect(builder).toContain('JSONBranch-macos-x64')
    expect(builder).not.toContain('6CX3WHS9HZ')
    expect(workflow).toContain('arch: [arm64, x64]')
    expect(workflow).toContain('runs-on: macos-15')
    expect(workflow).not.toContain('macos-14')
    expect(workflow).toContain('jsonbranch-chrome.zip')
    expect(workflow).toContain('workflow_dispatch')
    expect(readme).toContain('加载未打包的扩展程序')
    expect(readme).toContain('Gatekeeper')
  })
})
