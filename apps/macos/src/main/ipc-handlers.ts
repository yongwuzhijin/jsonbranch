import { dialog, type BrowserWindow } from 'electron'
import { openJsonFromDisk, saveGrantedJson, saveJsonAs, type MacFileStamp } from './document-io'

export type WindowGrants = Map<string, MacFileStamp>

export async function openDocument(): Promise<Awaited<ReturnType<typeof openJsonFromDisk>> | { status: 'canceled' }> {
  const selected = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  const file = selected.filePaths[0]
  if (selected.canceled || !file) {
    return { status: 'canceled' }
  }
  return openJsonFromDisk(file)
}

export async function saveDocument(
  grants: WindowGrants,
  input: { path: string; content: string; previous: string; overwrite: boolean }
) {
  return saveGrantedJson({ grants, ...input })
}

export async function saveDocumentAs(
  grants: WindowGrants,
  content: string,
  owner: BrowserWindow | null
): Promise<Awaited<ReturnType<typeof saveJsonAs>> | { status: 'canceled' }> {
  const options = { filters: [{ name: 'JSON', extensions: ['json'] }] }
  const selected = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options)
  if (selected.canceled || !selected.filePath) {
    return { status: 'canceled' as const }
  }
  const filePath = selected.filePath.toLowerCase().endsWith('.json') ? selected.filePath : `${selected.filePath}.json`
  return saveJsonAs({ grants, path: filePath, content })
}

export async function confirmDiscard(owner: BrowserWindow | null): Promise<'save' | 'discard' | 'cancel'> {
  const options = {
    type: 'question' as const,
    message: '关闭前要存储这份 JSON 吗？',
    buttons: ['存储', '不存储', '取消'],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  }
  const choice = owner ? await dialog.showMessageBox(owner, options) : await dialog.showMessageBox(options)
  return (['save', 'discard', 'cancel'] as const)[choice.response] ?? 'cancel'
}
