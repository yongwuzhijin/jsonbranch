import { createJsonDocument, isDirty, type JsonDocument } from '@jsonbranch/json-core'
import { IconButton, JsonWorkbench, TextSlot } from '@jsonbranch/json-view'
import { FileDown, FolderOpen, Save, X } from 'lucide-react'
import { useEffect, useRef, useState, type JSX } from 'react'
import type { MacFileStamp, MacSaveResult } from '../shared/macos-api'
import logoUrl from '../../../../build/icon.png'
import './mac-shell.css'

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
    open: '打开',
    saveFile: '保存',
    saveAs: '另存为',
    openHint: '打开 ⌘O',
    saveHint: '保存 ⌘S',
    saveAsHint: '另存为 ⇧⌘S',
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
    open: 'Open',
    saveFile: 'Save',
    saveAs: 'Save As',
    openHint: 'Open ⌘O',
    saveHint: 'Save ⌘S',
    saveAsHint: 'Save As ⇧⌘S',
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
  onOsCloseReady?: () => void
  editorFontSize?: number
  onEditorFontSize?: (size: number) => void
}): JSX.Element {
  const text = copy[props.locale]
  const [document, setDocument] = useState<JsonDocument>(() => createJsonDocument(props.initial))
  const [dialog, setDialog] = useState<'dirty' | 'stale' | null>(null)
  const [intent, setIntent] = useState<'close' | 'open' | 'stay'>('close')
  const intentRef = useRef(intent)
  function chooseIntent(next: 'close' | 'open' | 'stay'): void {
    intentRef.current = next
    setIntent(next)
  }
  const [closed, setClosed] = useState(false)
  const [error, setError] = useState('')
  const osClose = useRef(false)
  const storeRef = useRef<(overwrite: boolean, fromOs: boolean) => Promise<void>>(async () => {})

  useEffect(() => {
    const name = props.path?.split('/').at(-1) ?? '枝序'
    globalThis.document.title = isDirty(document) ? `${name} • 未存储` : name
  }, [document, props.path])

  function finish(): void {
    setClosed(true)
    setDialog(null)
    props.onClosed?.()
  }

  async function store(overwrite: boolean, fromOs = osClose.current): Promise<void> {
    const result = await props.save(document.input, { overwrite })
    if (result.status === 'ok' || result.status === 'unchanged') {
      setDocument((current) => ({ ...current, baseline: current.input }))
      if (!fromOs && intentRef.current === 'stay') {
        setDialog(null)
        return
      }
      if (intentRef.current === 'open' && !fromOs) {
        setDialog(null)
        props.onOpen?.()
        return
      }
      finish()
      if (fromOs) {
        osClose.current = false
        props.onOsCloseReady?.()
      }
      return
    }
    if (result.status === 'stale') {
      setDialog('stale')
      return
    }
    osClose.current = false
    setError(result.status === 'failed' ? result.message : result.status)
  }

  storeRef.current = store

  useEffect(() => {
    const onRequest = () => {
      osClose.current = true
      intentRef.current = 'close'
      setIntent('close')
      void storeRef.current(false, true)
    }
    window.addEventListener('jsonbranch-request-save-close', onRequest)
    const unsubscribe = window.jsonbranch?.onRequestSaveClose(onRequest) ?? (() => {})
    return () => {
      window.removeEventListener('jsonbranch-request-save-close', onRequest)
      unsubscribe()
    }
  }, [])

  if (closed) {
    return <p>{props.locale === 'zh' ? '已关闭' : 'Closed'}</p>
  }

  const fileName = props.path?.split('/').at(-1) ?? text.untitled
  const dirty = isDirty(document)
  const canSave = dirty && (props.path !== null || props.onSaveAs !== undefined)

  function saveHere(): void {
    if (!dirty) {
      return
    }
    if (props.path === null) {
      props.onSaveAs?.(document.input)
      return
    }
    osClose.current = false
    chooseIntent('stay')
    void store(false, false)
  }

  return (
    <div className="mac-shell">
      <header className="mac-title">
        <div className="mac-brand">
          <img className="mac-logo" src={logoUrl} alt="" width={22} height={22} />
          <span className="mac-brand-name">枝序</span>
          <span className="mac-brand-en">JSONBranch</span>
        </div>
        <span className="mac-title-rule" aria-hidden="true" />
        <div className="mac-file">
          <span className="mac-filename">{fileName}</span>
          {dirty ? <span className="mac-dirty">{text.dirty}</span> : null}
        </div>
        <div className="mac-actions">
          {props.onOpen ? (
            <IconButton
              hint={text.openHint}
              label={text.open}
              onClick={() => {
                if (!dirty) {
                  props.onOpen?.()
                  return
                }
                chooseIntent('open')
                setDialog('dirty')
              }}
            >
              <FolderOpen size={16} aria-hidden="true" />
            </IconButton>
          ) : null}
          <IconButton hint={text.saveHint} label={text.saveFile} disabled={!canSave} onClick={saveHere}>
            <Save size={16} aria-hidden="true" />
          </IconButton>
          {props.onSaveAs ? (
            <IconButton hint={text.saveAsHint} label={text.saveAs} onClick={() => props.onSaveAs?.(document.input)}>
              <FileDown size={16} aria-hidden="true" />
            </IconButton>
          ) : null}
          <IconButton
            hint={text.close}
            label={text.close}
            onClick={() => {
              if (!dirty) {
                finish()
                return
              }
              chooseIntent('close')
              setDialog('dirty')
            }}
          >
            <X size={16} aria-hidden="true" />
          </IconButton>
        </div>
      </header>
      {dialog === 'dirty' && (
        <div className="mac-dialog" role="dialog" aria-label={text.ask}>
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
          <button
            type="button"
            onClick={() => {
              osClose.current = false
              setDialog(null)
            }}
          >
            {text.cancel}
          </button>
        </div>
      )}
      {dialog === 'stale' && (
        <div className="mac-dialog" role="dialog" aria-label={text.stale}>
          <p>{text.stale}</p>
          <button type="button" onClick={() => void store(true)}>
            {text.overwrite}
          </button>
          <button
            type="button"
            onClick={() => {
              if (intentRef.current === 'stay') {
                setDialog(null)
                return
              }
              setDialog('dirty')
            }}
          >
            {text.cancel}
          </button>
        </div>
      )}
      {error ? <p role="alert">{error}</p> : null}
      <JsonWorkbench
        document={document}
        locale={props.locale}
        editorFontSize={props.editorFontSize}
        onEditorFontSize={props.onEditorFontSize}
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
