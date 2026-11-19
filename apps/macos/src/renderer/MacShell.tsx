import { createJsonDocument, isDirty, type JsonDocument } from '@jsonbranch/json-core'
import { JsonWorkbench, TextSlot } from '@jsonbranch/json-view'
import { useEffect, useState, type JSX } from 'react'
import type { MacFileStamp, MacSaveResult } from '../shared/macos-api'

type Save = (content: string, options?: { overwrite?: boolean }) => Promise<MacSaveResult>

const copy = {
  zh: {
    close: '关闭',
    save: '存储',
    discard: '不存储',
    cancel: '取消',
    overwrite: '覆盖',
    dirty: '未存储',
    untitled: '未打开的文档',
    ask: '关闭前要存储这份 JSON 吗？',
    stale: '磁盘上的文件已经变了。要覆盖它吗？'
  },
  en: {
    close: 'Close',
    save: 'Save',
    discard: "Don't Save",
    cancel: 'Cancel',
    overwrite: 'Overwrite',
    dirty: 'Unsaved',
    untitled: 'Untitled',
    ask: 'Save this JSON before closing?',
    stale: 'The file on disk has changed. Overwrite it?'
  }
}

export function MacShell(props: {
  path: string | null
  initial: string
  locale: 'zh' | 'en'
  save: Save
  onOpen?: () => void
  onSaveAs?: (content: string) => void
  onClosed?: () => void
}): JSX.Element {
  const text = copy[props.locale]
  const [document, setDocument] = useState<JsonDocument>(() => createJsonDocument(props.initial))
  const [dialog, setDialog] = useState<'dirty' | 'stale' | null>(null)
  const [intent, setIntent] = useState<'close' | 'open'>('close')
  const [closed, setClosed] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const name = props.path?.split('/').at(-1) ?? '枝序'
    globalThis.document.title = isDirty(document) ? `${name} • 未存储` : name
  }, [document, props.path])

  function finish(): void {
    setClosed(true)
    setDialog(null)
    props.onClosed?.()
  }

  async function store(overwrite: boolean): Promise<void> {
    const result = await props.save(document.input, { overwrite })
    if (result.status === 'ok' || result.status === 'unchanged') {
      setDocument((current) => ({ ...current, baseline: current.input }))
      if (intent === 'open') {
        setDialog(null)
        props.onOpen?.()
        return
      }
      finish()
      return
    }
    if (result.status === 'stale') {
      setDialog('stale')
      return
    }
    setError(result.status === 'failed' ? result.message : result.status)
  }

  if (closed) {
    return <p>{props.locale === 'zh' ? '已关闭' : 'Closed'}</p>
  }

  return (
    <div className="mac-shell">
      <header className="mac-title">
        <strong>{props.path ?? text.untitled}</strong>
        {isDirty(document) ? <span>{text.dirty}</span> : null}
        {props.onOpen ? (
          <button
            type="button"
            onClick={() => {
              if (!isDirty(document)) {
                props.onOpen?.()
                return
              }
              setIntent('open')
              setDialog('dirty')
            }}
          >
            {props.locale === 'zh' ? '打开' : 'Open'}
          </button>
        ) : null}
        {props.onSaveAs ? (
          <button type="button" onClick={() => props.onSaveAs?.(document.input)}>
            {props.locale === 'zh' ? '另存为' : 'Save As'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (!isDirty(document)) {
              finish()
              return
            }
            setIntent('close')
            setDialog('dirty')
          }}
        >
          {text.close}
        </button>
      </header>
      {dialog === 'dirty' && (
        <div role="dialog" aria-label={text.ask}>
          <p>{text.ask}</p>
          <button type="button" onClick={() => void store(false)}>
            {text.save}
          </button>
          <button
            type="button"
            onClick={() => {
              setDialog(null)
              if (intent === 'open') {
                props.onOpen?.()
                return
              }
              finish()
            }}
          >
            {text.discard}
          </button>
          <button type="button" onClick={() => setDialog(null)}>
            {text.cancel}
          </button>
        </div>
      )}
      {dialog === 'stale' && (
        <div role="dialog" aria-label={text.stale}>
          <p>{text.stale}</p>
          <button type="button" onClick={() => void store(true)}>
            {text.overwrite}
          </button>
          <button type="button" onClick={() => setDialog('dirty')}>
            {text.cancel}
          </button>
        </div>
      )}
      {error ? <p role="alert">{error}</p> : null}
      <JsonWorkbench
        document={document}
        locale={props.locale}
        onDocument={setDocument}
        TextSlot={TextSlot}
        copyText={async (value) => {
          if (window.jsonbranch) {
            await window.jsonbranch.writeClipboard(value)
            return
          }
          await navigator.clipboard.writeText(value)
        }}
      />
    </div>
  )
}

export type { MacFileStamp }
