import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { JsonbranchApi, MacOpenResult } from '../shared/macos-api'

const api: JsonbranchApi = {
  openDocument: () => ipcRenderer.invoke('jsonbranch:openDocument'),
  saveDocument: (input) => ipcRenderer.invoke('jsonbranch:saveDocument', input),
  saveDocumentAs: (input) => ipcRenderer.invoke('jsonbranch:saveDocumentAs', input),
  writeClipboard: (text) => ipcRenderer.invoke('jsonbranch:writeClipboard', text),
  confirmDiscard: () => ipcRenderer.invoke('jsonbranch:confirmDiscard'),
  onOpenFromOs: (callback) => {
    const listener = (_event: IpcRendererEvent, result: MacOpenResult) => callback(result)
    ipcRenderer.on('jsonbranch:openFromOs', listener)
    return () => ipcRenderer.removeListener('jsonbranch:openFromOs', listener)
  }
}

contextBridge.exposeInMainWorld('jsonbranch', Object.freeze(api))
