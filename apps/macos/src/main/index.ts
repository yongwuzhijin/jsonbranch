import { app, BrowserWindow, Menu, clipboard, ipcMain, protocol, session } from 'electron'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { choiceEffect, createCloseGate } from './close-gate'
import { openJsonFromDisk } from './document-io'
import { readEditorFontFile, writeEditorFontResult } from './editor-font-file'
import { openDocument, saveDocument, saveDocumentAs, confirmDiscard, type WindowGrants } from './ipc-handlers'
import { shouldBlockRequest, windowSecurityOptions } from './navigation'
import { resolveRendererFile } from './renderer-path'

const grants: WindowGrants = new Map()
const closeGate = createCloseGate()

const rendererRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../renderer')

function contentType(file: string): string {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8'
  if (file.endsWith('.js')) return 'text/javascript'
  if (file.endsWith('.css')) return 'text/css'
  if (file.endsWith('.json')) return 'application/json'
  if (file.endsWith('.svg')) return 'image/svg+xml'
  if (file.endsWith('.png')) return 'image/png'
  if (file.endsWith('.ttf')) return 'font/ttf'
  return 'application/octet-stream'
}

function registerAppProtocol(): void {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    let pathname = decodeURIComponent(url.pathname)
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html'
    }
    const file = resolveRendererFile(rendererRoot, pathname)
    if (file === null) {
      return new Response('denied', { status: 403 })
    }
    try {
      const bytes = await readFile(file)
      return new Response(bytes, {
        headers: {
          'content-type': contentType(file),
          'content-security-policy': "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self'"
        }
      })
    } catch {
      return new Response('missing', { status: 404 })
    }
  })
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    title: '枝序',
    webPreferences: {
      ...windowSecurityOptions(),
      preload: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../preload/index.js')
    }
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (shouldBlockRequest(url)) {
      event.preventDefault()
    }
  })
  window.on('close', (event) => {
    const dirty = window.getTitle().includes('未存储') || window.getTitle().includes('Unsaved')
    if (closeGate.shouldPrevent(dirty)) {
      event.preventDefault()
      void confirmDiscard(window).then((choice) => {
        const effect = choiceEffect(choice)
        if (effect === 'arm-and-close') {
          closeGate.arm()
          window.close()
          return
        }
        if (effect === 'request-save') {
          window.webContents.send('jsonbranch:request-save-close')
        }
      })
    }
  })
  void window.loadURL('app://jsonbranch/index.html')
  return window
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
  }
])

app.whenReady().then(() => {
  registerAppProtocol()
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (shouldBlockRequest(details.url)) {
      callback({ cancel: true })
      return
    }
    callback({})
  })
  ipcMain.handle('jsonbranch:openDocument', async () => {
    const opened = await openDocument()
    if (opened.status === 'ok') {
      grants.clear()
      grants.set(opened.path, opened.stamp)
    }
    return opened
  })
  ipcMain.handle('jsonbranch:saveDocument', async (_event, input: { path: string; content: string; previous: string; overwrite: boolean }) => {
    return saveDocument(grants, input)
  })
  ipcMain.handle('jsonbranch:saveDocumentAs', async (event, input: { content: string }) => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    return saveDocumentAs(grants, input.content, owner)
  })
  ipcMain.handle('jsonbranch:writeClipboard', async (_event, text: string) => {
    clipboard.writeText(text)
  })
  ipcMain.handle('jsonbranch:readEditorFontSize', () => readEditorFontFile(app.getPath('userData')))
  ipcMain.handle('jsonbranch:writeEditorFontSize', (_event, size: unknown) => writeEditorFontResult(app.getPath('userData'), size))
  ipcMain.handle('jsonbranch:confirmDiscard', async (event) => confirmDiscard(BrowserWindow.fromWebContents(event.sender)))
  ipcMain.on('jsonbranch:os-close-ready', (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (!owner) {
      return
    }
    closeGate.arm()
    owner.close()
  })
  const window = createWindow()
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: '枝序',
        submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }]
      },
      {
        label: '文件',
        submenu: [
          { label: '打开…', accelerator: 'CmdOrCtrl+O', click: () => window.webContents.send('jsonbranch:menu', 'open') },
          { label: '存储', accelerator: 'CmdOrCtrl+S', click: () => window.webContents.send('jsonbranch:menu', 'save') },
          { label: '另存为…', accelerator: 'CmdOrCtrl+Shift+S', click: () => window.webContents.send('jsonbranch:menu', 'save-as') }
        ]
      },
      { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] }
    ])
  )
  app.on('open-file', (event, file) => {
    event.preventDefault()
    void openJsonAndSend(window, file)
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

async function openJsonAndSend(window: BrowserWindow, file: string): Promise<void> {
  const opened = await openJsonFromDisk(file)
  if (opened.status === 'ok') {
    grants.clear()
    grants.set(opened.path, opened.stamp)
  }
  window.webContents.send('jsonbranch:openFromOs', opened)
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
