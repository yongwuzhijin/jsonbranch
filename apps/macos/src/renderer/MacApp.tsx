import { useEffect, useState, type JSX } from 'react'
import type { MacFileStamp, MacOpenResult, MacSaveResult } from '../shared/macos-api'
import { MacShell } from './MacShell'

type Opened = { path: string; content: string; stamp: MacFileStamp; key: number }

export function MacApp(): JSX.Element {
  const [opened, setOpened] = useState<Opened | null>(null)
  const [notice, setNotice] = useState('')
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
      <MacShell
        key={opened?.key ?? 0}
        path={opened?.path ?? null}
        initial={opened?.content ?? ''}
        locale={navigator.language.toLowerCase().startsWith('en') ? 'en' : 'zh'}
        save={save}
        onOpen={() => void open()}
        onSaveAs={(content) => void saveAs(content)}
        onOsCloseReady={() => window.jsonbranch.notifyOsCloseReady()}
      />
    </div>
  )
}
