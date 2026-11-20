import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeSync } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

export const MAX_JSON_FILE_BYTES = 20 * 1024 * 1024

export type MacFileStamp = {
  mtimeMs: number
  size: number
}

export type MacOpenResult =
  | { status: 'canceled' }
  | { status: 'error'; reason: 'not-file' | 'bad-extension' | 'not-utf8' | 'too-large' }
  | { status: 'ok'; path: string; content: string; stamp: MacFileStamp }

export type MacSaveResult =
  | { status: 'ok'; path: string; stamp: MacFileStamp }
  | { status: 'unchanged' }
  | { status: 'stale' }
  | { status: 'denied' }
  | { status: 'failed'; message: string }

export function inspectJsonOpen(input: {
  absolutePath: string
  bytes: Uint8Array
  isFile: boolean
  stamp: MacFileStamp
}): MacOpenResult {
  if (!input.isFile) {
    return { status: 'error', reason: 'not-file' }
  }
  if (!input.absolutePath.toLowerCase().endsWith('.json')) {
    return { status: 'error', reason: 'bad-extension' }
  }
  if (input.bytes.byteLength > MAX_JSON_FILE_BYTES) {
    return { status: 'error', reason: 'too-large' }
  }
  try {
    const content = new TextDecoder('utf-8', { fatal: true }).decode(input.bytes)
    return { status: 'ok', path: input.absolutePath, content, stamp: input.stamp }
  } catch {
    return { status: 'error', reason: 'not-utf8' }
  }
}

export function planJsonWrite(input: {
  granted: boolean
  current: MacFileStamp | null
  baseline: MacFileStamp
  next: string
  previous: string
  overwrite: boolean
}): { action: 'skip' | 'stale' | 'denied' } | { action: 'write'; bytes: Uint8Array } {
  if (!input.granted) {
    return { action: 'denied' }
  }
  const changed =
    input.current === null ||
    input.current.mtimeMs !== input.baseline.mtimeMs ||
    input.current.size !== input.baseline.size
  if (changed && !input.overwrite) {
    return { action: 'stale' }
  }
  if (input.next === input.previous) {
    return { action: 'skip' }
  }
  return { action: 'write', bytes: new TextEncoder().encode(input.next) }
}

export function writeFileAtomic(targetPath: string, bytes: Uint8Array): void {
  const directory = path.dirname(targetPath)
  mkdirSync(directory, { recursive: true })
  const temporary = path.join(
    directory,
    `.${path.basename(targetPath)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
  )
  const fd = openSync(temporary, 'w', 0o600)
  try {
    let offset = 0
    while (offset < bytes.byteLength) {
      offset += writeSync(fd, bytes, offset)
    }
    fsyncSync(fd)
  } catch (error) {
    closeSync(fd)
    unlinkSync(temporary)
    throw error
  }
  closeSync(fd)
  try {
    renameSync(temporary, targetPath)
  } catch (error) {
    unlinkSync(temporary)
    throw error
  }
}

export async function openJsonFromDisk(absolutePath: string): Promise<MacOpenResult> {
  let real: string
  try {
    real = await realpath(absolutePath)
  } catch {
    return { status: 'error', reason: 'not-file' }
  }
  let info
  try {
    info = await stat(real)
  } catch {
    return { status: 'error', reason: 'not-file' }
  }
  if (!info.isFile()) {
    return inspectJsonOpen({
      absolutePath: real,
      bytes: new Uint8Array(),
      isFile: false,
      stamp: { mtimeMs: info.mtimeMs, size: info.size }
    })
  }
  if (info.size > MAX_JSON_FILE_BYTES) {
    return { status: 'error', reason: 'too-large' }
  }
  const bytes = readFileSync(real)
  return inspectJsonOpen({
    absolutePath: real,
    bytes,
    isFile: true,
    stamp: { mtimeMs: info.mtimeMs, size: info.size }
  })
}

export async function saveGrantedJson(input: {
  grants: Map<string, MacFileStamp>
  path: string
  content: string
  previous: string
  overwrite: boolean
}): Promise<MacSaveResult> {
  let real: string
  try {
    real = await realpath(input.path)
  } catch {
    return { status: 'denied' }
  }
  const baseline = input.grants.get(real)
  if (!baseline) {
    return { status: 'denied' }
  }
  let current: MacFileStamp | null = null
  try {
    const info = await stat(real)
    if (!info.isFile()) {
      return { status: 'failed', message: '不是普通文件' }
    }
    current = { mtimeMs: info.mtimeMs, size: info.size }
  } catch {
    current = null
  }
  const plan = planJsonWrite({
    granted: true,
    current,
    baseline,
    next: input.content,
    previous: input.previous,
    overwrite: input.overwrite
  })
  if (plan.action !== 'write') {
    if (plan.action === 'skip') {
      return { status: 'unchanged' }
    }
    if (plan.action === 'stale') {
      return { status: 'stale' }
    }
    return { status: 'denied' }
  }
  try {
    writeFileAtomic(real, plan.bytes)
    const info = statSync(real)
    const stamp = { mtimeMs: info.mtimeMs, size: info.size }
    input.grants.set(real, stamp)
    return { status: 'ok', path: real, stamp }
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : '写入失败' }
  }
}

export async function saveJsonAs(input: {
  grants: Map<string, MacFileStamp>
  path: string
  content: string
}): Promise<MacSaveResult> {
  if (!input.path.toLowerCase().endsWith('.json')) {
    return { status: 'failed', message: '只能存储 .json 文件' }
  }
  try {
    writeFileAtomic(input.path, new TextEncoder().encode(input.content))
    const real = await realpath(input.path)
    const info = statSync(real)
    const stamp = { mtimeMs: info.mtimeMs, size: info.size }
    input.grants.clear()
    input.grants.set(real, stamp)
    return { status: 'ok', path: real, stamp }
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : '写入失败' }
  }
}
