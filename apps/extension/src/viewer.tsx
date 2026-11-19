import { createJsonDocument, type JsonDocument } from '@jsonbranch/json-core'
import { JsonWorkbench, TextSlot } from '@jsonbranch/json-view'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { chooseLocale } from '../../../src/shared/locale'
import { chromeLocalArea, loadStoredDocument, saveStoredDocument } from './storage'

function storedFrom(document: JsonDocument) {
  return {
    input: document.input,
    keepEscapes: document.keepEscapes,
    showLineNumbers: document.showLineNumbers
  }
}

function Viewer() {
  const locale = chooseLocale(navigator.language || 'zh')
  const [ready, setReady] = useState(false)
  const [document, setDocument] = useState<JsonDocument>(createJsonDocument())
  const copyTarget = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let cancelled = false
    void loadStoredDocument(chromeLocalArea()).then((stored) => {
      if (cancelled) {
        return
      }
      setDocument({
        ...createJsonDocument(stored.input),
        keepEscapes: stored.keepEscapes,
        showLineNumbers: stored.showLineNumbers
      })
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready) {
      return
    }
    void saveStoredDocument(chromeLocalArea(), storedFrom(document))
  }, [document, ready])

  return (
    <>
      <JsonWorkbench
        document={document}
        locale={locale}
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

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<Viewer />)
}
