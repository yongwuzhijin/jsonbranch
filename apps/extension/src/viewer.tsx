import { createJsonDocument, type JsonDocument } from '@jsonbranch/json-core'
import { JsonWorkbench, messages, TextSlot } from '@jsonbranch/json-view'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { chooseLocale } from '../../../src/shared/locale'
import { chromeLocalArea, loadEditorFontSize, loadStoredDocument, saveEditorFontSize, saveStoredDocument, type StorageArea } from './storage'

function storedFrom(document: JsonDocument) {
  return {
    input: document.input,
    keepEscapes: document.keepEscapes,
    showLineNumbers: document.showLineNumbers
  }
}

export function ViewerApp({ area, locale }: { area: StorageArea; locale: 'zh' | 'en' }) {
  const [ready, setReady] = useState(false)
  const [canPersist, setCanPersist] = useState(false)
  const [document, setDocument] = useState<JsonDocument>(createJsonDocument())
  const [notice, setNotice] = useState('')
  const [fontSize, setFontSize] = useState(13)
  const [fontReady, setFontReady] = useState(false)
  const [fontNotice, setFontNotice] = useState('')
  const fontHydrated = useRef(false)
  const copyTarget = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let cancelled = false
    void loadStoredDocument(area)
      .then((stored) => {
        if (cancelled) {
          return
        }
        setDocument({
          ...createJsonDocument(stored.input),
          keepEscapes: stored.keepEscapes,
          showLineNumbers: stored.showLineNumbers
        })
        setCanPersist(true)
        setReady(true)
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        setNotice('无法读取本机记录')
        setCanPersist(false)
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [area])

  useEffect(() => {
    let cancelled = false
    void loadEditorFontSize(area).then((size) => {
      if (cancelled) {
        return
      }
      setFontSize(size)
      setFontReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [area])

  useEffect(() => {
    if (!fontReady) {
      return
    }
    if (!fontHydrated.current) {
      fontHydrated.current = true
      return
    }
    let cancelled = false
    void saveEditorFontSize(area, fontSize)
      .then(() => {
        if (!cancelled) {
          setFontNotice('')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFontNotice(messages(locale).fontSaveFailed)
        }
      })
    return () => {
      cancelled = true
    }
  }, [area, fontSize, fontReady, locale])

  useEffect(() => {
    if (!ready || !canPersist) {
      return
    }
    let cancelled = false
    void saveStoredDocument(area, storedFrom(document))
      .then(() => {
        if (!cancelled) {
          setNotice('')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotice('无法保存在本机')
        }
      })
    return () => {
      cancelled = true
    }
  }, [area, document, ready, canPersist])

  if (!ready || !fontReady) {
    return <p>正在读取本机记录</p>
  }

  return (
    <>
      {notice ? <p role="alert">{notice}</p> : null}
      {fontNotice ? <p role="alert">{fontNotice}</p> : null}
      <JsonWorkbench
        document={document}
        locale={locale}
        editorFontSize={fontSize}
        onEditorFontSize={setFontSize}
        onDocument={setDocument}
        TextSlot={TextSlot}
        copyText={async (text) => {
          try {
            await navigator.clipboard.writeText(text)
          } catch (error) {
            const area = copyTarget.current
            if (area) {
              area.value = text
              area.removeAttribute('aria-hidden')
              area.focus()
              area.select()
              area.setAttribute('aria-hidden', 'true')
            }
            throw error instanceof Error ? error : new Error('copy failed')
          }
        }}
      />
      <textarea ref={copyTarget} className="json-copy-sink" aria-hidden="true" tabIndex={-1} readOnly />
    </>
  )
}

function Viewer() {
  const [area] = useState(() => chromeLocalArea())
  const [locale] = useState(() => chooseLocale(navigator.language || 'zh'))
  return <ViewerApp area={area} locale={locale} />
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<Viewer />)
}
