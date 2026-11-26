import type { JsonHistoryEntry } from '@jsonbranch/json-core'
import { messages } from '@jsonbranch/json-view'
import { normalizeEditorFontSize } from '@jsonbranch/json-view/editor-font-size'
import { useEffect, useState, type JSX } from 'react'
import type { MacFileStamp, MacOpenResult, MacSaveResult } from '../shared/macos-api'
import { MacShell } from './MacShell'

type Opened = { path: string; content: string; stamp: MacFileStamp; key: number }

export function MacApp(): JSX.Element {
  const [opened, setOpened] = useState<Opened | null>(null)
  const [notice, setNotice] = useState('')
  const [editorFontSize, setEditorFontSize] = useState(13)
  const [fontNotice, setFontNotice] = useState('')
  const [history, setHistory] = useState<JsonHistoryEntry[]>([])
  const [historyReady, setHistoryReady] = useState(false)
  const locale = navigator.language.toLowerCase().startsWith('en') ? 'en' : 'zh'
  const api = window.jsonbranch

  useEffect(() => {
    if (!api) {
      return
    }
    return api.onOpenFromOs((result) => {
      if (result.status === 'ok') {
        setOpened({ path: result.path, content: result.content, stamp: result.stamp, key: Date.now() })
        setNotice('')
      } else if (result.status === 'error') {
        setNotice(result.reason)
      }
    })
  }, [api])

  useEffect(() => {
    if (!api?.readJsonHistory) {
      setHistoryReady(true)
      return
    }
    let cancelled = false
    void api.readJsonHistory()
      .then((entries) => {
        if (!cancelled) setHistory(entries)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setHistoryReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [api])

  useEffect(() => {
    if (!api) {
      return
    }
    let cancelled = false
    void api.readEditorFontSize()
      .then((size) => {
        if (!cancelled) {
          setEditorFontSize(normalizeEditorFontSize(size))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEditorFontSize(13)
        }
      })
    return () => {
      cancelled = true
    }
  }, [api])

  async function changeFont(size: number): Promise<void> {
    const next = normalizeEditorFontSize(size)
    setEditorFontSize(next)
    try {
      const result = await api.writeEditorFontSize(next)
      setFontNotice(result.ok ? '' : messages(locale).fontSaveFailed)
    } catch {
      setFontNotice(messages(locale).fontSaveFailed)
    }
  }

  async function open(): Promise<void> {
    const result: MacOpenResult = await api.openDocument()
    if (result.status === 'ok') {
      setOpened({ path: result.path, content: result.content, stamp: result.stamp, key: Date.now() })
      setNotice('')
    } else if (result.status === 'error') {
      setNotice(result.reason)
    }
  }

  async function save(content: string, options?: { overwrite?: boolean }): Promise<MacSaveResult> {
    if (!opened) {
      return saveAs(content)
    }
    const result = await api.saveDocument({
      path: opened.path,
      content,
      previous: opened.content,
      stamp: opened.stamp,
      overwrite: options?.overwrite ?? false
    })
    if (result.status === 'ok') {
      setOpened((current) => (current ? { ...current, content, stamp: result.stamp } : current))
    }
    return result
  }

  async function saveAs(content: string): Promise<MacSaveResult> {
    const created = await api.saveDocumentAs({ content })
    if (created.status === 'ok') {
      setOpened({ path: created.path, content, stamp: created.stamp, key: Date.now() })
      return created
    }
    if (created.status === 'canceled') {
      return { status: 'failed', message: '已取消' }
    }
    return created
  }

  return (
    <div className="mac-app">
      {notice ? <p role="alert">{notice}</p> : null}
      {fontNotice ? <p role="alert">{fontNotice}</p> : null}
      <MacShell
        key={opened?.key ?? 0}
        path={opened?.path ?? null}
        initial={opened?.content ?? ''}
        locale={locale}
        editorFontSize={editorFontSize}
        onEditorFontSize={(size) => void changeFont(size)}
        history={history}
        historyReady={historyReady}
        onHistoryChange={(entries) => {
          setHistory(entries)
          void api?.writeJsonHistory?.(entries)
        }}
        save={save}
        onOpen={() => void open()}
        onSaveAs={(content) => void saveAs(content)}
        onOsCloseReady={() => window.jsonbranch.notifyOsCloseReady()}
      />
    </div>
  )
}
