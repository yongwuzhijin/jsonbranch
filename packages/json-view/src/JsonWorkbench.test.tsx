import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createJsonDocument, isDirty, type JsonDocument } from '@jsonbranch/json-core'
import { JsonWorkbench } from './JsonWorkbench'
import { TOOLTIP_DELAY_MS } from './Tooltip'

afterEach(() => cleanup())

function Host({
  copyText,
  initial = '{"name":"Beta"}'
}: {
  copyText: (text: string) => Promise<void>
  initial?: string
}) {
  const [document, setDocument] = useState<JsonDocument>(createJsonDocument(initial))
  return (
    <JsonWorkbench
      document={document}
      locale="zh"
      onDocument={setDocument}
      copyText={copyText}
      TextSlot={({ value, onChange }) => (
        <textarea aria-label="json" value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    />
  )
}

describe('JsonWorkbench', () => {
  it('formats, finds a value, and copies the path', () => {
    const copyText = vi.fn(async () => {})
    render(<Host copyText={copyText} />)
    fireEvent.click(screen.getByRole('button', { name: '格式化' }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'beta' } })
    expect(screen.getByText('1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '复制路径' }))
    expect(copyText).toHaveBeenCalledWith('name')
  })

  it('deletes the selected node and undoes back to the original text', () => {
    const copyText = vi.fn(async () => {})
    render(<Host copyText={copyText} />)
    fireEvent.click(screen.getByTestId('json-tree-row-name'))
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect((screen.getByLabelText('json') as HTMLTextAreaElement).value).toBe('{}')
    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    expect((screen.getByLabelText('json') as HTMLTextAreaElement).value).toBe('{"name":"Beta"}')
  })

  it('shows the empty state and a Chinese comment error', async () => {
    const copyText = vi.fn(async () => {})
    render(<Host copyText={copyText} />)
    fireEvent.click(screen.getByRole('button', { name: '清空' }))
    expect(screen.getByText('没有内容')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('json'), { target: { value: '{ /* x */ }' } })
    expect(await screen.findByText(/注释/)).toBeTruthy()
  })

  it('keeps accessible names and removes visible function names', () => {
    render(<Host copyText={async () => {}} />)
    const names = ['格式化', '压缩', '示例', '全部展开', '全部折叠', '行号', '复制原文', '复制结果', '复制路径', '复制键值对', '复制值', '删除', '撤销', '清空', '保留转义']
    for (const name of names) {
      const button = screen.getByRole('button', { name })
      expect(button.hasAttribute('title')).toBe(false)
      expect(button.textContent?.includes(name)).toBe(false)
      expect(button.querySelector('svg')).toBeTruthy()
    }
    expect(document.querySelector('.json-workbench [title]')).toBeNull()
    expect(screen.queryByRole('checkbox', { name: '保留转义' })).toBeNull()
  })

  it('uses Chinese tooltips and English accessible names', async () => {
    vi.useFakeTimers()
    try {
      render(
        <JsonWorkbench
          document={createJsonDocument('{"name":"Beta"}')}
          locale="en"
          onDocument={() => {}}
          copyText={async () => {}}
          TextSlot={() => <textarea aria-label="json" />}
        />
      )
      const pairs = [
        ['Format', '格式化'],
        ['Expand all', '全部展开'],
        ['Collapse all', '全部折叠'],
        ['Line numbers', '行号'],
        ['Copy source', '复制原文'],
        ['Copy result', '复制结果'],
        ['Minify', '压缩'],
        ['Demo', '示例'],
        ['Copy path', '复制路径'],
        ['Copy pair', '复制键值对'],
        ['Copy value', '复制值'],
        ['Delete', '删除'],
        ['Undo', '撤销'],
        ['Clear', '清空'],
        ['Keep escapes', '保留转义'],
        ['Decrease font size, current 13', '减小字号，当前 13'],
        ['Increase font size, current 13', '增大字号，当前 13']
      ]
      for (const [label, hint] of pairs) {
        const button = screen.getByRole('button', { name: label })
        expect(button.hasAttribute('title')).toBe(false)
        fireEvent.pointerEnter(button.parentElement!)
        await act(async () => {
          await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY_MS)
        })
        expect(screen.getByRole('tooltip').textContent).toBe(hint)
        fireEvent.pointerLeave(button.parentElement!)
        expect(screen.queryByRole('tooltip')).toBeNull()
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('gives every toolbar button and every row action its own icon', () => {
    render(<Host copyText={async () => {}} />)
    const toolbarIcons = iconNames(document.querySelector('.json-editor-tools'))
    expect(toolbarIcons).toEqual(['wand-sparkles', 'chevrons-down-up', 'lightbulb', 'undo2', 'clipboard-copy', 'eraser'])
    expect(new Set(toolbarIcons).size).toBe(toolbarIcons.length)
    const viewIcons = iconNames(document.querySelector('.json-view-tools'))
    expect(new Set(viewIcons).size).toBe(viewIcons.length)
    expect(viewIcons).toContain('whole-word')
    expect(viewIcons).toContain('braces')
    const rowIcons = iconNames(screen.getByTestId('json-tree-row-name').querySelector('.json-row-actions'))
    expect(rowIcons).toEqual(['braces', 'route', 'whole-word', 'trash2'])
    expect(new Set(rowIcons).size).toBe(rowIcons.length)
    expect(rowIcons.filter((name) => name === 'braces')).toEqual(['braces'])
  })

  it('toggles line numbers and keep escapes without changing the text', () => {
    render(<Host copyText={async () => {}} />)
    const lines = screen.getByRole('button', { name: '行号' })
    const escapes = screen.getByRole('button', { name: '保留转义' })
    expect(lines.getAttribute('aria-pressed')).toBe('false')
    expect(escapes.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(lines)
    fireEvent.click(escapes)
    expect(lines.getAttribute('aria-pressed')).toBe('true')
    expect(escapes.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('1')).toBeTruthy()
    expect((screen.getByLabelText('json') as HTMLTextAreaElement).value).toBe('{"name":"Beta"}')
  })

  it('keeps the existing disabled conditions', () => {
    render(<Host copyText={async () => {}} initial="" />)
    expect(screen.getByRole('button', { name: '格式化' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '压缩' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '复制路径' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '复制键值对' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '复制值' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '撤销' }).hasAttribute('disabled')).toBe(true)
  })

  it('disables delete on the root row', () => {
    render(<Host copyText={async () => {}} />)
    fireEvent.click(screen.getByTestId('json-tree-row-root'))
    expect(screen.getByRole('button', { name: '删除' }).hasAttribute('disabled')).toBe(true)
  })

  it('changes only the editor font size and disables both ends', () => {
    const seen: number[] = []
    function FontHost() {
      const [document, setDocument] = useState(createJsonDocument('{"name":"Beta"}'))
      const [fontSize, setFontSize] = useState(13)
      return (
        <JsonWorkbench
          document={document}
          locale="zh"
          editorFontSize={fontSize}
          onDocument={setDocument}
          onEditorFontSize={setFontSize}
          copyText={async () => {}}
          TextSlot={({ fontSize: size }) => {
            seen.push(size ?? -1)
            return <textarea aria-label="json" value={document.input} readOnly />
          }}
        />
      )
    }
    render(<FontHost />)
    fireEvent.click(screen.getByRole('button', { name: '减小字号，当前 13' }))
    expect(seen).toContain(12)
    const decrease = screen.getByRole('button', { name: '减小字号，当前 12' })
    expect(decrease.hasAttribute('disabled')).toBe(true)
    expect(decrease.hasAttribute('aria-pressed')).toBe(false)
    cleanup()
    function UpperHost() {
      const [document, setDocument] = useState(createJsonDocument('{"name":"Beta"}'))
      return (
        <JsonWorkbench
          document={document}
          locale="zh"
          editorFontSize={24}
          onDocument={setDocument}
          onEditorFontSize={() => {}}
          copyText={async () => {}}
          TextSlot={() => <textarea aria-label="json" />}
        />
      )
    }
    render(<UpperHost />)
    const increase = screen.getByRole('button', { name: '增大字号，当前 24' })
    expect(increase.hasAttribute('disabled')).toBe(true)
    fireEvent.click(increase)
    expect(increase.getAttribute('aria-label')).toBe('增大字号，当前 24')
  })

  it('does not mark the document dirty when the font size changes', () => {
    let latest = createJsonDocument('{"name":"Beta"}')
    function DirtyHost() {
      const [document, setDocument] = useState(latest)
      const [fontSize, setFontSize] = useState(13)
      return (
        <JsonWorkbench
          document={document}
          locale="zh"
          editorFontSize={fontSize}
          onDocument={(next) => {
            latest = next
            setDocument(next)
          }}
          onEditorFontSize={setFontSize}
          copyText={async () => {}}
          TextSlot={({ value, onChange }) => (
            <textarea aria-label="json" value={value} onChange={(event) => onChange(event.target.value)} />
          )}
        />
      )
    }
    render(<DirtyHost />)
    fireEvent.click(screen.getByRole('button', { name: '增大字号，当前 13' }))
    expect(isDirty(latest)).toBe(false)
    expect(latest.undoInput).toBeNull()
    expect(latest.input).toBe('{"name":"Beta"}')
    expect(latest.baseline).toBe('{"name":"Beta"}')
  })

  it('draws a keyboard ring and a two-part pressed state', () => {
    const css = readFileSync('packages/json-view/src/workbench.css', 'utf8')
    const visible = css.match(/\.json-toolbar button:focus-visible\s*\{([^}]+)\}/)?.[1] ?? ''
    expect(visible).toContain('outline: 2px solid var(--accent)')
    expect(visible).not.toContain('outline: none')
    const pressed = css.match(/\.json-toolbar button\[aria-pressed='true'\]\s*\{([^}]+)\}/)?.[1] ?? ''
    expect(pressed).toContain('background:')
    expect(pressed).toContain('color:')
    expect(pressed).not.toContain('border')
    expect(css).toMatch(/\.json-toolbar,\s*\.json-search\s*\{[^}]*height:\s*40px/)
    expect(css).toContain('#f8f9fb')
    expect(css).toContain('#e5e7eb')
    expect(css).toContain('-apple-system, BlinkMacSystemFont, "PingFang SC"')
    expect(css).toContain('"SF Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace')
    expect(css).toMatch(/\.json-row\s*\{[^}]*font-size:\s*13px/)
  })

  it('minifies, builds a schema, and restores a history snapshot', async () => {
    vi.useFakeTimers()
    try {
      const onHistoryChange = vi.fn()
      const copyText = vi.fn(async () => {})
      render(<Host copyText={copyText} />)
      fireEvent.click(screen.getByRole('button', { name: '压缩' }))
      expect((screen.getByLabelText('json') as HTMLTextAreaElement).value).toBe('{"name":"Beta"}')
      fireEvent.click(screen.getByRole('button', { name: '转 JSON Schema' }))
      expect(screen.getByText(/json-schema.org/)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: '树形视图' }))
      cleanup()
      function HistoryHost() {
        const [document, setDocument] = useState(createJsonDocument('{"name":"Beta"}'))
        return (
          <JsonWorkbench
            document={document}
            locale="zh"
            history={[{ id: 'old', text: '{"restored":true}', savedAt: Date.now(), bytes: 18 }]}
            historyReady
            onHistoryChange={onHistoryChange}
            onDocument={setDocument}
            copyText={async () => {}}
            TextSlot={({ value, onChange }) => <textarea aria-label="json" value={value} onChange={(event) => onChange(event.target.value)} />}
          />
        )
      }
      render(<HistoryHost />)
      fireEvent.change(screen.getByLabelText('json'), { target: { value: '{"name":"Gamma"}' } })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })
      expect(onHistoryChange).toHaveBeenCalled()
      expect(onHistoryChange.mock.calls.at(-1)?.[0][0].text).toBe('{"name":"Gamma"}')
      fireEvent.click(screen.getByRole('button', { name: /刚刚/ }))
      expect((screen.getByLabelText('json') as HTMLTextAreaElement).value).toBe('{"restored":true}')
      fireEvent.click(screen.getByRole('button', { name: '撤销' }))
      expect((screen.getByLabelText('json') as HTMLTextAreaElement).value).toBe('{"name":"Gamma"}')
    } finally {
      vi.useRealTimers()
    }
  })
})

function iconNames(root: ParentNode | null): string[] {
  return [...(root?.querySelectorAll('button svg') ?? [])].map((svg) => {
    const match = svg.getAttribute('class')?.match(/lucide-([a-z0-9-]+)/)
    return match?.[1] ?? ''
  })
}
