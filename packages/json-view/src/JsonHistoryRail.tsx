import { BookmarkPlus, PanelLeftClose, Trash, X } from 'lucide-react'
import type { JsonHistoryEntry } from '@jsonbranch/json-core'
import { formatHistoryAge, formatHistoryBytes, formatHistoryClock, formatHistoryPreview } from '@jsonbranch/json-core'
import type { JSX } from 'react'
import { messages, type WorkbenchLocale } from './messages'
import { IconButton } from './Tooltip'

export function JsonHistoryRail(props: {
  entries: readonly JsonHistoryEntry[]
  locale: WorkbenchLocale
  now: number
  onCollapse(): void
  onSave(): void
  onClear(): void
  onDelete(id: string): void
  onRestore(text: string, id: string): void
}): JSX.Element {
  const copy = messages(props.locale)
  const hint = messages('zh')
  return (
    <aside className="json-history">
      <div className="json-history-tools json-toolbar">
        <strong>{copy.history}</strong>
        <IconButton hint={hint.saveSnapshot} label={copy.saveSnapshot} onClick={props.onSave}>
          <BookmarkPlus size={15} aria-hidden="true" />
        </IconButton>
        <IconButton hint={hint.clearHistory} label={copy.clearHistory} onClick={props.onClear} disabled={props.entries.length === 0}>
          <Trash size={15} aria-hidden="true" />
        </IconButton>
        <IconButton hint={hint.toggleHistory} label={copy.toggleHistory} onClick={props.onCollapse}>
          <PanelLeftClose size={15} aria-hidden="true" />
        </IconButton>
      </div>
      <div className="json-history-list">
        {props.entries.length === 0 ? <p className="json-history-empty">{copy.historyEmpty}</p> : null}
        {props.entries.map((entry) => {
          const preview = formatHistoryPreview(entry.text)
          return (
            <div className="json-history-card" key={entry.id}>
              <button type="button" className="json-history-open" onClick={() => props.onRestore(entry.text, entry.id)}>
                <span>{formatHistoryAge(entry.savedAt, props.now, props.locale)}</span>
                <span className="json-history-preview">{preview}</span>
                <span className="json-history-meta">{formatHistoryClock(entry.savedAt)}</span>
                <span className="json-history-meta">{formatHistoryBytes(entry.bytes)}</span>
              </button>
              <IconButton hint={hint.deleteHistory} label={copy.deleteHistory} onClick={() => props.onDelete(entry.id)}>
                <X size={13} aria-hidden="true" />
              </IconButton>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
