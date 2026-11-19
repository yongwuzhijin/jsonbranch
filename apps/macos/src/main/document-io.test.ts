import { chmodSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { inspectJsonOpen, openJsonFromDisk, planJsonWrite, saveGrantedJson, saveJsonAs } from './document-io'

describe('mac json files', () => {
  it('loads invalid json and refuses a file over 20 MiB', () => {
    const opened = inspectJsonOpen({
      absolutePath: '/a.json',
      bytes: new TextEncoder().encode('{'),
      isFile: true,
      stamp: { mtimeMs: 1, size: 1 }
    })
    expect(opened).toMatchObject({ status: 'ok', content: '{' })
    const huge = new Uint8Array(20 * 1024 * 1024 + 1)
    expect(inspectJsonOpen({
      absolutePath: '/a.json',
      bytes: huge,
      isFile: true,
      stamp: { mtimeMs: 1, size: huge.byteLength }
    })).toMatchObject({ status: 'error', reason: 'too-large' })
  })

  it('does not write unchanged text', () => {
    expect(planJsonWrite({
      granted: true,
      current: { mtimeMs: 1, size: 1 },
      baseline: { mtimeMs: 1, size: 1 },
      next: '{',
      previous: '{',
      overwrite: false
    })).toEqual({ action: 'skip' })
  })

  it('asks before replacing a file that changed and refuses an ungranted path', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'jsonbranch-'))
    const file = path.join(dir, 'a.json')
    writeFileSync(file, '{')
    const opened = await openJsonFromDisk(file)
    expect(opened).toMatchObject({ status: 'ok', content: '{' })
    if (opened.status !== 'ok') {
      return
    }
    const grants = new Map([[opened.path, opened.stamp]])
    const other = path.join(dir, 'secret.json')
    writeFileSync(other, '{}')
    expect(await saveGrantedJson({
      grants,
      path: other,
      content: '{"no":true}',
      previous: '{}',
      overwrite: false
    })).toMatchObject({ status: 'denied' })
    expect(readFileSync(other, 'utf8')).toBe('{}')

    const stamped = await openJsonFromDisk(file)
    if (stamped.status !== 'ok') {
      return
    }
    writeFileSync(file, '{"outside":1}')
    expect(await saveGrantedJson({
      grants,
      path: file,
      content: '{"a":1}',
      previous: '{',
      overwrite: false
    })).toMatchObject({ status: 'stale' })
    expect(readFileSync(file, 'utf8')).toBe('{"outside":1}')

    const saved = await saveGrantedJson({
      grants,
      path: file,
      content: '{"a":1}',
      previous: '{',
      overwrite: true
    })
    expect(saved.status).toBe('ok')
    expect(readFileSync(file, 'utf8')).toBe('{"a":1}')
    expect(readdirSync(dir).filter((name) => name.includes('.tmp'))).toEqual([])

    const created = await saveJsonAs({ grants, path: path.join(dir, 'copy.json'), content: '[1]' })
    expect(created.status).toBe('ok')
    expect(readFileSync(path.join(dir, 'copy.json'), 'utf8')).toBe('[1]')
    expect(await saveGrantedJson({
      grants,
      path: file,
      content: '{"back":1}',
      previous: '{"a":1}',
      overwrite: true
    })).toMatchObject({ status: 'denied' })
  })

  it('keeps the original bytes when the directory rejects the temporary file', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'jsonbranch-ro-'))
    const file = path.join(dir, 'a.json')
    writeFileSync(file, '{"keep":1}')
    const opened = await openJsonFromDisk(file)
    expect(opened.status).toBe('ok')
    if (opened.status !== 'ok') {
      return
    }
    const grants = new Map([[opened.path, opened.stamp]])
    chmodSync(dir, 0o555)
    try {
      const saved = await saveGrantedJson({
        grants,
        path: file,
        content: '{"lose":1}',
        previous: '{"keep":1}',
        overwrite: true
      })
      expect(saved.status).toBe('failed')
      expect(grants.get(opened.path)).toEqual(opened.stamp)
    } finally {
      chmodSync(dir, 0o755)
    }
    expect(readFileSync(file, 'utf8')).toBe('{"keep":1}')
    expect(readdirSync(dir).filter((name) => name.includes('.tmp'))).toEqual([])
  })
})
