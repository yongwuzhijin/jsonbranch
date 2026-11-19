import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createJsonDocument, type JsonDocument } from '@jsonbranch/json-core'
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
})
