import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createJsonDocument, isDirty, type JsonDocument } from '@jsonbranch/json-core'
import { JsonWorkbench } from './JsonWorkbench'

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
    const names = ['格式化', '全部展开', '全部折叠', '行号', '复制', '复制路径', '复制键值对', '复制值', '删除', '撤销', '清空', '保留转义']
    for (const name of names) {
      const button = screen.getByRole('button', { name, exact: true })
      expect(button.getAttribute('title')).toBe(name)
      expect(button.textContent?.includes(name)).toBe(false)
      expect(button.querySelector('svg')).toBeTruthy()
    }
    expect(screen.queryByRole('checkbox', { name: '保留转义' })).toBeNull()
  })

  it('uses Chinese titles and English accessible names', () => {
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
      ['Copy', '复制'],
      ['Copy path', '复制路径'],
      ['Copy pair', '复制键值对'],
      ['Copy value', '复制值'],
      ['Delete', '删除'],
      ['Undo', '撤销'],
      ['Clear', '清空'],
      ['Keep escapes', '保留转义']
    ]
    for (const [label, title] of pairs) {
      expect(screen.getByRole('button', { name: label, exact: true }).getAttribute('title')).toBe(title)
    }
    expect(screen.getByRole('button', { name: 'Decrease font size, current 13', exact: true }).getAttribute('title')).toBe('减小字号，当前 13')
    expect(screen.getByRole('button', { name: 'Increase font size, current 13', exact: true }).getAttribute('title')).toBe('增大字号，当前 13')
  })

  it('toggles line numbers and keep escapes without changing the text', () => {
    render(<Host copyText={async () => {}} />)
    const lines = screen.getByRole('button', { name: '行号', exact: true })
    const escapes = screen.getByRole('button', { name: '保留转义', exact: true })
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
    expect(screen.getByRole('button', { name: '格式化', exact: true }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '复制', exact: true }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '复制路径', exact: true }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '复制键值对', exact: true }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '复制值', exact: true }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '撤销', exact: true }).hasAttribute('disabled')).toBe(true)
  })

  it('disables delete on the root row', () => {
    render(<Host copyText={async () => {}} />)
    fireEvent.click(screen.getByTestId('json-tree-row-root'))
    expect(screen.getByRole('button', { name: '删除', exact: true }).hasAttribute('disabled')).toBe(true)
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
    fireEvent.click(screen.getByRole('button', { name: '减小字号，当前 13', exact: true }))
    expect(seen).toContain(12)
    const decrease = screen.getByRole('button', { name: '减小字号，当前 12', exact: true })
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
    const increase = screen.getByRole('button', { name: '增大字号，当前 24', exact: true })
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
    fireEvent.click(screen.getByRole('button', { name: '增大字号，当前 13', exact: true }))
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
    expect(pressed).toContain('border-color:')
    expect(css).toMatch(/\.json-row\s*\{[^}]*font-size:\s*13px/)
  })
})
