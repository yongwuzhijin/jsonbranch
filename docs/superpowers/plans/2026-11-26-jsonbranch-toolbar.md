# 枝序 JSONBranch 工具栏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把共享 JSON 顶栏改成纯图标，悬浮固定显示中文功能名，并为 Monaco 与 textarea 增加 12–24 的本机字号，且不改文档正文、脏标记和 macOS 文件保存。

**Architecture:** `normalizeEditorFontSize` 放在 `packages/json-view` 的无 React 文件里，经包的子路径导出，Chrome、macOS 渲染进程和 Electron 主进程都调用它。顶栏仍是 `JsonWorkbench` 的同一排按钮；字号通过 `TextSlot` 的 `fontSize` 进入 Monaco 和 textarea。Chrome 把数字写在 `chrome.storage.local` 的 `editorFontSize`，与 `document` 分开。macOS 把 `{ "fontSize": N }` 写在 userData 的 `editor-font-size.json`，只经新增的两个 IPC 读写，不进入 `saveGrantedJson`。

**Tech Stack:** React `19.2.8`，`lucide-react` `0.577.0`，`monaco-editor` `0.55.1`，`@monaco-editor/react` `4.7.0`，Vitest `5.0.3`，`@testing-library/react` `16.3.0`，Electron `43.7.5`，TypeScript `5.9.3`。

本文路径：`docs/superpowers/plans/2026-11-26-jsonbranch-toolbar.md`。设计依据是已于 2026-11-26 确认的 `docs/superpowers/specs/2026-11-20-jsonbranch-toolbar-design.md`。

## Global Constraints

下列约束对每个任务生效。规格第 1 节里「`title` 与 `aria-label` 都写当前语言」那一句，以第 3 节和本计划为准：悬浮 `title` 固定中文，`aria-label` 跟随界面语言。

- 图标只使用已安装的 `lucide-react` `0.577.0`。不新增图标包，不新增提示组件。
- 顶栏 11 个操作是：格式化、全部展开、全部折叠、行号、复制、复制路径、复制键值对、复制值、删除、撤销、清空。保留转义是第 12 个控件。字号减小、字号增大是第 13、第 14 个控件。
- 悬浮 `title` 固定为：格式化、全部展开、全部折叠、行号、复制、复制路径、复制键值对、复制值、删除、撤销、清空、保留转义。字号是「减小字号，当前 N」和「增大字号，当前 N」，N 是按下之前的当前值。
- `aria-label` 在中文界面与上面的中文相同。英文界面是 Format、Expand all、Collapse all、Line numbers、Copy、Copy path、Copy pair、Copy value、Delete、Undo、Clear、Keep escapes，以及 “Decrease font size, current N” 和 “Increase font size, current N”。
- 图标带 `aria-hidden="true"`，不进入可访问名称。现有测试继续用可访问名称查找。顶栏「复制路径」使用精确匹配，避免命中树行上的「复制路径 name」。
- 可用顶栏按钮的 `:focus-visible` 显示 `2px solid var(--accent)`。这个规则里不能写 `outline: none`。`:focus` 可以写 `outline: none`，让鼠标点击不留下焦点环。
- 行号和保留转义使用 `aria-pressed`。选中时沿用 `.json-toolbar button[aria-pressed='true']` 的背景和边框。未选中恢复普通按钮。禁用按钮保持 `disabled`，不能带选中外观。
- 禁用语义不变：解析不是成功时，格式化和复制禁用；没有当前行时，复制路径、复制键值对、复制值禁用；没有当前行或当前行是根时，删除禁用；`undoInput === null` 时撤销禁用。当前行仍是手点选优先，否则用当前搜索命中。
- 字号是 12 到 24 的整数，步长 1，默认 13。`normalizeEditorFontSize` 对缺失、`null`、非数字、数字字符串、小数、`NaN`、小于 12、大于 24 返回 13，不夹取。12 和 24 保持原值。
- 字号只进入 Monaco 的 `options.fontSize` 和 textarea 的行内 `fontSize`。「正在打开编辑器」不跟随字号。`.json-row` 保持 `font-size: 13px`。
- 改字号不调用 `onDocument`，不改 `input`、`baseline`、`undoInput`，不使 `isDirty` 为真。
- Chrome 的 `document` 继续只保存 `input`、`keepEscapes`、`showLineNumbers`。字号使用另一个键 `editorFontSize`。缺键或读取失败得到 13，并且该读取不调用 `document` 的写入。写入失败时保留本次会话字号，正文照常保存，提示「字号未能记在本机」或 “Font size was not saved on this device.” 只有下一次字号写入成功才清除这句提示。
- macOS 偏好文件是 `app.getPath('userData')` 下的 `editor-font-size.json`，内容只有 `{"fontSize":N}`。文件缺失、读失败或内容不合法时得到 13，读取不创建文件。写入失败保留本次会话字号并显示同一句提示。不改打开、另存为、关闭的对话框和 `saveGrantedJson`。不做 macOS 草稿自动恢复。不加「检查是否自动保存」按钮。
- 不改树行按钮、搜索框、上一处、下一处、分栏、解析、格式化、搜索、删除和撤销规则。不改 Orca。不改 `.github/workflows/release.yml`。不手动运行发布工作流。

## 文件职责

| 路径 | 职责 |
| --- | --- |
| `packages/json-view/src/editor-font-size.ts` | 纯函数。无 React，无宿主 API |
| `packages/json-view/src/messages.ts` | 顶栏中英文，包括带当前值的字号名和失败提示 |
| `packages/json-view/src/TextSlot.tsx` | 把整数传给 Monaco 和 textarea |
| `packages/json-view/src/JsonWorkbench.tsx` | 纯图标顶栏、中文 `title`、语言 `aria-label`、字号按钮 |
| `packages/json-view/src/workbench.css` | 焦点环；选中背景和边框保持现有规则 |
| `apps/extension/src/storage.ts` | `editorFontSize` 的读写，与 `document` 分开 |
| `apps/extension/src/viewer.tsx` | 读取并保存扩展字号，失败提示不阻断编辑 |
| `apps/macos/src/main/editor-font-file.ts` | userData 偏好文件的读写 |
| `apps/macos/src/main/index.ts` | 只新增两个 IPC，不改打开、保存和关闭 |
| `apps/macos/src/preload/index.ts` | 把这两个调用放进冻结的 `window.jsonbranch` |
| `apps/macos/src/renderer/MacApp.tsx` | 持有本次会话字号，调用偏好 IPC |
| `apps/macos/src/renderer/MacShell.tsx` | 把字号传进工作台，不改外层三个关闭选择 |

图标按这个表使用，尺寸都是 `14`：

| 控件 | 组件 |
| --- | --- |
| 格式化 | `Wand2` |
| 全部展开 | `UnfoldVertical` |
| 全部折叠 | `FoldVertical` |
| 行号 | `ListOrdered` |
| 复制 | `Copy` |
| 复制路径 | `Route` |
| 复制键值对 | `Braces` |
| 复制值 | `WholeWord` |
| 删除 | `Trash2` |
| 撤销 | `Undo2` |
| 清空 | `Eraser` |
| 保留转义 | `TextQuote` |
| 减小字号 | `Minus` |
| 增大字号 | `Plus` |

这些名字都已存在于 `lucide-react` `0.577.0` 的类型声明。树行上的 `Braces`、`Route`、`Trash2` 保持不动。

---

### Task 1: 字号纯函数与文案

**Files:**
- Create: `packages/json-view/src/editor-font-size.ts`
- Create: `packages/json-view/src/editor-font-size.test.ts`
- Modify: `packages/json-view/src/messages.ts`
- Modify: `packages/json-view/src/index.ts`
- Modify: `packages/json-view/package.json`
- Test: `packages/json-view/src/editor-font-size.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `EDITOR_FONT_MIN = 12`
  - `EDITOR_FONT_MAX = 24`
  - `EDITOR_FONT_DEFAULT = 13`
  - `normalizeEditorFontSize(value: unknown): number`
  - `stepEditorFontSize(current: unknown, direction: -1 | 1): number`
  - `messages(locale: 'zh' | 'en').decreaseFont(current: number): string`
  - `messages(locale: 'zh' | 'en').increaseFont(current: number): string`
  - `messages(locale: 'zh' | 'en').fontSaveFailed: string`
  - 包导出 `@jsonbranch/json-view/editor-font-size` 只指向该纯函数文件，Electron 主进程不得从 `@jsonbranch/json-view` 桶文件导入它

- [ ] **Step 1: Write the failing test**

创建 `packages/json-view/src/editor-font-size.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { messages } from './messages'
import { normalizeEditorFontSize, stepEditorFontSize } from './editor-font-size'

describe('normalizeEditorFontSize', () => {
  it('keeps integers inside 12 through 24', () => {
    expect(normalizeEditorFontSize(13)).toBe(13)
    expect(normalizeEditorFontSize(12)).toBe(12)
    expect(normalizeEditorFontSize(24)).toBe(24)
  })

  it('returns 13 for missing, illegal, and out-of-range values without clamping', () => {
    expect(normalizeEditorFontSize(undefined)).toBe(13)
    expect(normalizeEditorFontSize(null)).toBe(13)
    expect(normalizeEditorFontSize('13')).toBe(13)
    expect(normalizeEditorFontSize(13.5)).toBe(13)
    expect(normalizeEditorFontSize(Number.NaN)).toBe(13)
    expect(normalizeEditorFontSize(Number.POSITIVE_INFINITY)).toBe(13)
    expect(normalizeEditorFontSize(11)).toBe(13)
    expect(normalizeEditorFontSize(25)).toBe(13)
  })

  it('steps by one and normalizes the result', () => {
    expect(stepEditorFontSize(13, -1)).toBe(12)
    expect(stepEditorFontSize(13, 1)).toBe(14)
    expect(stepEditorFontSize(12, -1)).toBe(13)
    expect(stepEditorFontSize(24, 1)).toBe(13)
    expect(stepEditorFontSize('13', 1)).toBe(13)
  })
})

describe('font messages', () => {
  it('uses the value from before the click', () => {
    expect(messages('zh').decreaseFont(13)).toBe('减小字号，当前 13')
    expect(messages('zh').increaseFont(24)).toBe('增大字号，当前 24')
    expect(messages('zh').fontSaveFailed).toBe('字号未能记在本机')
    expect(messages('en').decreaseFont(13)).toBe('Decrease font size, current 13')
    expect(messages('en').increaseFont(24)).toBe('Increase font size, current 24')
    expect(messages('en').fontSaveFailed).toBe('Font size was not saved on this device.')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/json-view/src/editor-font-size.test.ts`

Expected: FAIL，因为 `./editor-font-size` 不存在，或 `messages('zh').decreaseFont` 不是函数。

- [ ] **Step 3: Write minimal implementation**

创建 `packages/json-view/src/editor-font-size.ts`：

```ts
export const EDITOR_FONT_MIN = 12
export const EDITOR_FONT_MAX = 24
export const EDITOR_FONT_DEFAULT = 13

export function normalizeEditorFontSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return EDITOR_FONT_DEFAULT
  }
  if (value < EDITOR_FONT_MIN || value > EDITOR_FONT_MAX) {
    return EDITOR_FONT_DEFAULT
  }
  return value
}

export function stepEditorFontSize(current: unknown, direction: -1 | 1): number {
  return normalizeEditorFontSize(normalizeEditorFontSize(current) + direction)
}
```

`Number.isInteger` 对 `NaN` 和 `Infinity` 返回 false，所以这两个值走默认 13。`stepEditorFontSize(12, -1)` 得到 13，因为 11 不合法且不夹取。按钮在 12 和 24 时必须禁用，Task 3 的点击处理也要先返回，不能把这次回退当成用户操作。

在 `packages/json-view/src/messages.ts` 的 `zh` 对象末尾、`collapseNode` 之后增加：

```ts
  decreaseFont: (current: number) => `减小字号，当前 ${current}`,
  increaseFont: (current: number) => `增大字号，当前 ${current}`,
  fontSaveFailed: '字号未能记在本机'
```

在 `en` 对象的相同位置增加：

```ts
  decreaseFont: (current: number) => `Decrease font size, current ${current}`,
  increaseFont: (current: number) => `Increase font size, current ${current}`,
  fontSaveFailed: 'Font size was not saved on this device.'
```

`en` 继续写成 `const en: typeof zh`。不要把现有 11 个操作和保留转义的文案改掉。

在 `packages/json-view/src/index.ts` 末尾增加：

```ts
export {
  EDITOR_FONT_DEFAULT,
  EDITOR_FONT_MAX,
  EDITOR_FONT_MIN,
  normalizeEditorFontSize,
  stepEditorFontSize
} from './editor-font-size'
```

把 `packages/json-view/package.json` 的 `exports` 改成：

```json
  "exports": {
    ".": "./src/index.ts",
    "./editor-font-size": "./src/editor-font-size.ts"
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/json-view/src/editor-font-size.test.ts`

Expected: PASS，两个 describe 共 4 个测试通过。

- [ ] **Step 5: Commit**

```bash
git add packages/json-view/src/editor-font-size.ts packages/json-view/src/editor-font-size.test.ts packages/json-view/src/messages.ts packages/json-view/src/index.ts packages/json-view/package.json
git commit -m "feat: normalize editor font size to the closed 12-24 range"
```

---

### Task 2: Monaco 与 textarea 使用同一个字号

**Files:**
- Modify: `packages/json-view/src/json-view-model.ts`
- Modify: `packages/json-view/src/TextSlot.tsx`
- Modify: `packages/json-view/src/TextSlot.test.tsx`
- Test: `packages/json-view/src/TextSlot.test.tsx`

**Interfaces:**
- Consumes: `normalizeEditorFontSize(value: unknown): number`
- Produces: `TextSlotProps` 增加可选字段 `fontSize?: number`。`TextSlot` 读取它。缺省或非法值按 13 渲染。树组件不接收这个字段。

- [ ] **Step 1: Write the failing test**

在 `packages/json-view/src/TextSlot.test.tsx` 的 describe 里追加：

```tsx
  it('applies a valid font size to the fallback textarea', () => {
    render(<TextSlot value="{}" fontSize={18} onChange={() => {}} createWorker={() => { throw new EvalError('csp') }} />)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).style.fontSize).toBe('18px')
  })

  it('uses 13px when the font size is missing or illegal', () => {
    const { rerender } = render(<TextSlot value="{}" onChange={() => {}} createWorker={() => { throw new EvalError('csp') }} />)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).style.fontSize).toBe('13px')
    rerender(<TextSlot value="{}" fontSize={11} onChange={() => {}} createWorker={() => { throw new EvalError('csp') }} />)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).style.fontSize).toBe('13px')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/json-view/src/TextSlot.test.tsx`

Expected: FAIL，新增两个测试里的 `style.fontSize` 是空字符串。原有两个测试仍通过。

- [ ] **Step 3: Write minimal implementation**

把 `packages/json-view/src/json-view-model.ts` 的 `TextSlotProps` 改成：

```ts
export type TextSlotProps = {
  value: string
  fontSize?: number
  onChange(value: string): void
}
```

在 `packages/json-view/src/TextSlot.tsx` 增加导入：

```ts
import { normalizeEditorFontSize } from './editor-font-size'
```

在 `TextSlot` 函数开头把解构改成：

```ts
  const { value, onChange, createWorker } = props
  const fontSize = normalizeEditorFontSize(props.fontSize)
```

降级 textarea 增加行内字号：

```tsx
      <textarea
        className="json-fallback"
        style={{ fontSize }}
        aria-label="json"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
```

Monaco 尚未就绪时的状态保持原样，不把 `fontSize` 加到「正在打开编辑器」：

```tsx
    return <div className="json-tree-message" role="status">正在打开编辑器</div>
```

传给 `@monaco-editor/react` 的 `loading` textarea 使用同一个整数，`options.fontSize` 替换硬编码的 `13`：

```tsx
      loading={<textarea className="json-fallback" style={{ fontSize }} aria-label="json" spellCheck={false} value={value} readOnly />}
      onChange={(next) => onChange(next ?? '')}
      options={{
        fontSize,
        minimap: { enabled: false },
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        renderWhitespace: 'none'
      }}
```

不要改 `.json-row`。`.json-fallback` 的样式表字号可以留着，行内样式会覆盖它。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/json-view/src/TextSlot.test.tsx`

Expected: PASS，4 个测试通过。

- [ ] **Step 5: Commit**

```bash
git add packages/json-view/src/json-view-model.ts packages/json-view/src/TextSlot.tsx packages/json-view/src/TextSlot.test.tsx
git commit -m "feat: pass editor font size into Monaco and the textarea fallback"
```

---

### Task 3: 纯图标顶栏、中文悬浮名和字号按钮

**Files:**
- Modify: `packages/json-view/src/JsonWorkbench.tsx`
- Modify: `packages/json-view/src/workbench.css`
- Modify: `packages/json-view/src/JsonWorkbench.test.tsx`
- Modify: `apps/macos/src/renderer/MacShell.test.tsx`
- Modify: `apps/extension/viewer.e2e.ts`
- Test: `packages/json-view/src/JsonWorkbench.test.tsx`
- Test: `apps/macos/src/renderer/MacShell.test.tsx`

**Interfaces:**
- Consumes: `messages`，`normalizeEditorFontSize`，`stepEditorFontSize`，`TextSlotProps.fontSize`
- Produces: `JsonWorkbench` 增加可选属性 `editorFontSize?: number` 和 `onEditorFontSize?(size: number): void`。两者都缺省时，工作台自己记住本次会话字号，默认 13。传入 `editorFontSize` 后变为受控，点击只调用 `onEditorFontSize`，不调用 `onDocument`。

- [ ] **Step 1: Write the failing test**

在 `packages/json-view/src/JsonWorkbench.test.tsx` 顶部增加 `import { readFileSync } from 'node:fs'`。现有的 `@jsonbranch/json-core` 导入改成同时导入 `createJsonDocument` 和 `isDirty`，不要另写一行 json-core 导入。在 describe 末尾追加：

```tsx
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
```

在 `apps/macos/src/renderer/MacShell.test.tsx` 追加：

```tsx
  it('does not mark a clean mac document unsaved when the editor font changes', () => {
    const save = vi.fn(async () => ({ status: 'ok' as const, path: '/a.json', stamp: { mtimeMs: 1, size: 1 } }))
    render(<MacShell path="/a.json" initial="{}" locale="zh" save={save} />)
    fireEvent.click(screen.getByRole('button', { name: '增大字号，当前 13', exact: true }))
    expect(screen.queryByText('未存储')).toBeNull()
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '增大字号，当前 14', exact: true })).toBeTruthy()
  })
```

把 `apps/extension/viewer.e2e.ts` 里判断中英文的两行：

```ts
    const formatButton = page.getByRole('button', { name: /^(格式化|Format)$/ })
    await expect(formatButton).toBeVisible()
    const chinese = (await formatButton.innerText()).includes('格式')
```

换成：

```ts
    const formatButton = page.getByRole('button', { name: /^(格式化|Format)$/ })
    await expect(formatButton).toBeVisible()
    await expect(formatButton).toHaveAttribute('title', '格式化')
    const chinese = (await formatButton.getAttribute('aria-label')) === '格式化'
```

后面的 `label.copyPath` 仍传给 `getByRole('button', { name: label.copyPath, exact: true })`。不要改删除和撤销的 `exact: true`。

现有 `JsonWorkbench.test.tsx` 里 `getByRole('button', { name: '格式化' })`、`复制路径`、`删除`、`撤销`、`清空` 保持原样。Testing Library 对字符串名称默认精确匹配，树行的可访问名称是「复制路径 name」，不会和顶栏冲突。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/json-view/src/JsonWorkbench.test.tsx apps/macos/src/renderer/MacShell.test.tsx`

Expected: FAIL。新的顶栏测试找不到 `title`，或仍找得到「保留转义」复选框。MacShell 新测试找不到「增大字号，当前 13」。原有格式化、删除、撤销、清空和关闭测试在实现前仍可通过。

- [ ] **Step 3: Write minimal implementation**

在 `packages/json-view/src/workbench.css` 的 `.json-toolbar button:disabled` 规则之后增加：

```css
.json-toolbar button:focus {
  outline: none;
}

.json-toolbar button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

不要改已有的：

```css
.json-toolbar button[aria-pressed='true'] {
  background: var(--accent-soft);
  border-color: var(--accent);
}
```

不要改 `.json-row` 的 `font-size: 13px`。`.json-keep` 可以留下，顶栏不再使用它。

把 `packages/json-view/src/JsonWorkbench.tsx` 的 lucide 导入改为：

```tsx
import {
  Braces,
  Copy,
  Eraser,
  FoldVertical,
  ListOrdered,
  Minus,
  Plus,
  Route,
  TextQuote,
  Trash2,
  Undo2,
  UnfoldVertical,
  Wand2,
  WholeWord,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
```

`ChevronDown` 和 `ChevronUp` 仍只用于搜索的上一处和下一处。搜索按钮的文字和图标都不要改。

增加导入：

```tsx
import { normalizeEditorFontSize, stepEditorFontSize } from './editor-font-size'
```

`JsonWorkbench` 的属性增加两个可选字段：

```tsx
export function JsonWorkbench(props: {
  document: JsonDocument
  locale: 'zh' | 'en'
  editorFontSize?: number
  TextSlot: (props: TextSlotProps) => JSX.Element
  copyText: CopyText
  onDocument(document: JsonDocument): void
  onEditorFontSize?(size: number): void
}): JSX.Element {
```

函数体内，在现有 `const copy = messages(locale)` 下面增加：

```tsx
  const title = messages('zh')
  const [uncontrolledFontSize, setUncontrolledFontSize] = useState(13)
  const fontControlled = props.editorFontSize !== undefined
  const editorFontSize = normalizeEditorFontSize(fontControlled ? props.editorFontSize : uncontrolledFontSize)
  function changeFont(direction: -1 | 1): void {
    if (direction === -1 && editorFontSize <= 12) {
      return
    }
    if (direction === 1 && editorFontSize >= 24) {
      return
    }
    const next = stepEditorFontSize(editorFontSize, direction)
    if (fontControlled) {
      props.onEditorFontSize?.(next)
      return
    }
    setUncontrolledFontSize(next)
  }
```

把 `<div className="json-toolbar">` 整段替换为：

```tsx
      <div className="json-toolbar">
        <button type="button" title={title.format} aria-label={copy.format} disabled={result.status !== 'ok'} onClick={() => publish(applyFormat(document))}>
          <Wand2 size={14} aria-hidden="true" />
        </button>
        <button type="button" title={title.expandAll} aria-label={copy.expandAll} onClick={() => setExpansion(expandAllJsonNodes())}>
          <UnfoldVertical size={14} aria-hidden="true" />
        </button>
        <button type="button" title={title.collapseAll} aria-label={copy.collapseAll} onClick={() => setExpansion(collapseAllJsonNodes())}>
          <FoldVertical size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={title.lineNumbers}
          aria-label={copy.lineNumbers}
          aria-pressed={document.showLineNumbers}
          onClick={() => onDocument({ ...document, showLineNumbers: !document.showLineNumbers })}
        >
          <ListOrdered size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={title.copy}
          aria-label={copy.copy}
          disabled={result.status !== 'ok'}
          onClick={() => {
            if (result.status === 'ok') {
              void writeCopy(JSON.stringify(result.value, null, 2))
            }
          }}
        >
          <Copy size={14} aria-hidden="true" />
        </button>
        <button type="button" title={title.copyPath} aria-label={copy.copyPath} disabled={current === null} onClick={() => current && void writeCopy(toCopyablePath(current.path))}>
          <Route size={14} aria-hidden="true" />
        </button>
        <button type="button" title={title.copyPair} aria-label={copy.copyPair} disabled={current === null} onClick={() => current && void writeCopy(buildJsonPairText(current))}>
          <Braces size={14} aria-hidden="true" />
        </button>
        <button type="button" title={title.copyValue} aria-label={copy.copyValue} disabled={current === null} onClick={() => current && void writeCopy(buildJsonValueText(current))}>
          <WholeWord size={14} aria-hidden="true" />
        </button>
        <button type="button" title={title.delete} aria-label={copy.delete} disabled={current === null || current.segments.length === 0} onClick={() => current && removeRow(current)}>
          <Trash2 size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={title.undo}
          aria-label={copy.undo}
          disabled={document.undoInput === null}
          onClick={() => {
            const next = applyUndo(document)
            publish(next, parseJsonInput(next.input, { keepEscapes: next.keepEscapes }))
          }}
        >
          <Undo2 size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={title.clear}
          aria-label={copy.clear}
          onClick={() => {
            const next = applyInput(document, '')
            publish(next, { status: 'empty' })
            setQuery('')
          }}
        >
          <Eraser size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={title.keepEscapes}
          aria-label={copy.keepEscapes}
          aria-pressed={document.keepEscapes}
          onClick={() => onDocument({ ...document, keepEscapes: !document.keepEscapes })}
        >
          <TextQuote size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={title.decreaseFont(editorFontSize)}
          aria-label={copy.decreaseFont(editorFontSize)}
          disabled={editorFontSize <= 12}
          onClick={() => changeFont(-1)}
        >
          <Minus size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          title={title.increaseFont(editorFontSize)}
          aria-label={copy.increaseFont(editorFontSize)}
          disabled={editorFontSize >= 24}
          onClick={() => changeFont(1)}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
```

删除原来的 `<label className="json-keep">` 复选框。搜索区、分栏、树和状态栏保持原样。

编辑区改成把字号传进文本槽：

```tsx
          <TextSlot
            value={document.input}
            fontSize={editorFontSize}
            onChange={(value) => onDocument(applyInput(document, value))}
          />
```

不要改 `JsonTreeView` 的调用，除了它本来就接收的 `showLineNumbers`。不要改树行按钮的 `aria-label`。

`changeFont` 在 12 和 24 先返回。因此即使用测试库向禁用按钮派发点击，字号也不会从 12 跳回 13，也不会从 24 跳回 13。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/json-view/src/JsonWorkbench.test.tsx apps/macos/src/renderer/MacShell.test.tsx`

Expected: PASS。工作台原有 3 个测试和新测试都通过。MacShell 原有关闭、打开测试和新的字号测试都通过。

- [ ] **Step 5: Commit**

```bash
git add packages/json-view/src/JsonWorkbench.tsx packages/json-view/src/workbench.css packages/json-view/src/JsonWorkbench.test.tsx apps/macos/src/renderer/MacShell.test.tsx apps/extension/viewer.e2e.ts
git commit -m "feat: show the JSON toolbar as icons with Chinese titles"
```

---

### Task 4: Chrome 用独立键记住字号

**Files:**
- Modify: `apps/extension/src/storage.ts`
- Modify: `apps/extension/src/viewer.tsx`
- Modify: `apps/extension/src/viewer-persistence.test.tsx`
- Modify: `apps/extension/viewer.e2e.ts`
- Test: `apps/extension/src/viewer-persistence.test.tsx`

**Interfaces:**
- Consumes: `normalizeEditorFontSize(value: unknown): number`，`messages(locale).fontSaveFailed`，`JsonWorkbench` 的 `editorFontSize` 与 `onEditorFontSize`
- Produces:
  - `EDITOR_FONT_KEY = 'editorFontSize'`
  - `loadEditorFontSize(area: StorageArea): Promise<number>`
  - `saveEditorFontSize(area: StorageArea, size: number): Promise<void>`
  - `saveEditorFontSize` 写入数字，不写入对象，不写入 `document`

- [ ] **Step 1: Write the failing test**

先把 `apps/extension/src/viewer-persistence.test.tsx` 里迟到读取那个测试的 `get` 改成按键区分，避免字号读取把文档读取的 Promise 盖掉：

```tsx
    const area: StorageArea = {
      get: (key) => {
        if (key !== 'document') {
          return Promise.resolve(undefined)
        }
        return new Promise((resolve) => { finish = resolve })
      },
      set: vi.fn(async () => {})
    }
```

这个测试的其余断言不动。再在文件顶部导入：

```tsx
import { loadEditorFontSize, saveEditorFontSize } from './storage'
```

在 describe 末尾追加：

```tsx
  it('returns 13 for a missing or illegal font value and does not write the document', async () => {
    const set = vi.fn(async () => {})
    expect(await loadEditorFontSize({ get: async () => undefined, set })).toBe(13)
    expect(await loadEditorFontSize({ get: async () => '13', set })).toBe(13)
    expect(await loadEditorFontSize({ get: async () => 11, set })).toBe(13)
    expect(await loadEditorFontSize({ get: async () => { throw new Error('storage unavailable') }, set })).toBe(13)
    expect(set).not.toHaveBeenCalled()
    await saveEditorFontSize({ get: async () => undefined, set }, 18)
    expect(set).toHaveBeenCalledWith('editorFontSize', 18)
    expect(set).not.toHaveBeenCalledWith('document', expect.anything())
  })

  it('remembers a font change without rewriting the document record', async () => {
    const set = vi.fn(async () => {})
    const area: StorageArea = {
      get: async (key) => (key === 'document' ? { input: '{"a":1}', keepEscapes: true, showLineNumbers: false } : undefined),
      set
    }
    render(<ViewerApp area={area} locale="zh" />)
    expect(await screen.findByDisplayValue('{"a":1}')).toBeTruthy()
    await vi.waitFor(() => {
      expect(set).toHaveBeenCalledWith('document', expect.objectContaining({ input: '{"a":1}' }))
    })
    set.mockClear()
    fireEvent.click(screen.getByRole('button', { name: '增大字号，当前 13', exact: true }))
    expect(await screen.findByRole('button', { name: '增大字号，当前 14', exact: true })).toBeTruthy()
    expect(set).toHaveBeenCalledWith('editorFontSize', 14)
    expect(set).not.toHaveBeenCalledWith('document', expect.anything())
    expect(screen.getByDisplayValue('{"a":1}')).toBeTruthy()
  })

  it('keeps the selected font and the document when font storage fails', async () => {
    let failFont = true
    const set = vi.fn(async (key: string) => {
      if (key === 'editorFontSize' && failFont) {
        throw new Error('quota')
      }
    })
    const area: StorageArea = {
      get: async (key) => (key === 'document' ? { input: '{}', keepEscapes: true, showLineNumbers: false } : 13),
      set
    }
    render(<ViewerApp area={area} locale="zh" />)
    fireEvent.click(await screen.findByRole('button', { name: '增大字号，当前 13', exact: true }))
    expect((await screen.findByRole('alert')).textContent).toContain('字号未能记在本机')
    expect(screen.getByRole('button', { name: '增大字号，当前 14', exact: true })).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"b":2}' } })
    expect(await screen.findByDisplayValue('{"b":2}')).toBeTruthy()
    await vi.waitFor(() => {
      expect(set).toHaveBeenCalledWith('document', expect.objectContaining({ input: '{"b":2}' }))
    })
    expect(screen.getByText('字号未能记在本机')).toBeTruthy()
    failFont = false
    fireEvent.click(screen.getByRole('button', { name: '增大字号，当前 14', exact: true }))
    expect(await screen.findByRole('button', { name: '增大字号，当前 15', exact: true })).toBeTruthy()
    expect(screen.queryByText('字号未能记在本机')).toBeNull()
  })

  it('uses the English font error without blocking the editor', async () => {
    const area: StorageArea = {
      get: async (key) => (key === 'document' ? { input: '{}', keepEscapes: true, showLineNumbers: false } : 13),
      set: async (key) => {
        if (key === 'editorFontSize') {
          throw new Error('quota')
        }
      }
    }
    render(<ViewerApp area={area} locale="en" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Increase font size, current 13', exact: true }))
    expect((await screen.findByRole('alert')).textContent).toContain('Font size was not saved on this device.')
    expect(screen.getByDisplayValue('{}')).toBeTruthy()
  })
```

在 `apps/extension/viewer.e2e.ts` 的撤销断言之后、`expect(external).toEqual([])` 之前追加：

```ts
    const increase = page.getByRole('button', { name: /^(增大字号，当前 13|Increase font size, current 13)$/ })
    await increase.click()
    await expect(page.getByRole('button', { name: /^(增大字号，当前 14|Increase font size, current 14)$/ })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: /^(增大字号，当前 14|Increase font size, current 14)$/ })).toBeVisible()
    await expect
      .poll(async () =>
        background.evaluate(async () => {
          const data = await chrome.storage.local.get('editorFontSize')
          return data.editorFontSize
        })
      )
      .toBe(14)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/extension/src/viewer-persistence.test.tsx`

Expected: FAIL。`loadEditorFontSize` 尚未导出。不要在这一步运行 Playwright。

- [ ] **Step 3: Write minimal implementation**

在 `apps/extension/src/storage.ts` 增加导入：

```ts
import { normalizeEditorFontSize } from '@jsonbranch/json-view/editor-font-size'
```

在 `DOCUMENT_KEY` 旁边增加：

```ts
export const EDITOR_FONT_KEY = 'editorFontSize'
```

在 `saveStoredDocument` 之后增加：

```ts
export async function loadEditorFontSize(area: StorageArea): Promise<number> {
  try {
    return normalizeEditorFontSize(await area.get(EDITOR_FONT_KEY))
  } catch {
    return 13
  }
}

export async function saveEditorFontSize(area: StorageArea, size: number): Promise<void> {
  await area.set(EDITOR_FONT_KEY, normalizeEditorFontSize(size))
}
```

不要修改 `loadStoredDocument` 和 `saveStoredDocument` 的字段。

在 `apps/extension/src/viewer.tsx` 增加导入：

```tsx
import { messages } from '@jsonbranch/json-view'
import { loadEditorFontSize, saveEditorFontSize } from './storage'
```

`saveStoredDocument` 仍从 `./storage` 导入。`ViewerApp` 增加状态：

```tsx
  const [fontSize, setFontSize] = useState(13)
  const [fontReady, setFontReady] = useState(false)
  const [fontNotice, setFontNotice] = useState('')
  const fontHydrated = useRef(false)
```

在现有文档读取 effect 之后增加两个 effect：

```tsx
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
```

React 19 会把同一次 `then` 里的 `setFontSize` 和 `setFontReady` 批处理。保存 effect 第一次看到的是读取结果，水合标记让它跳过写入。用户之后再改字号才写入。

把提前返回改成同时等待两份读取：

```tsx
  if (!ready || !fontReady) {
    return <p>正在读取本机记录</p>
  }
```

渲染两句独立提示，文档保存成功不得清除字号提示：

```tsx
      {notice ? <p role="alert">{notice}</p> : null}
      {fontNotice ? <p role="alert">{fontNotice}</p> : null}
```

`JsonWorkbench` 增加：

```tsx
        editorFontSize={fontSize}
        onEditorFontSize={setFontSize}
```

不要把 `fontSize` 放进 `storedFrom` 或 `createJsonDocument`。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run apps/extension/src/viewer-persistence.test.tsx apps/extension/src/extension-contract.test.ts`

Expected: PASS。持久化测试包含原有的迟到读取、读取失败和正文写入失败。契约测试里 `document` 的三字段断言保持通过。

然后构建并运行扩展端到端测试：

Run: `pnpm build:extension && pnpm test:extension`

Expected: PASS。格式化后的 `document.input` 仍含 `Beta`，刷新后编辑区仍含 `Beta`，`editorFontSize` 在刷新后是 `14`。复制路径、删除、撤销仍用精确可访问名称。

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/storage.ts apps/extension/src/viewer.tsx apps/extension/src/viewer-persistence.test.tsx apps/extension/viewer.e2e.ts
git commit -m "feat: remember the extension editor font size outside the document"
```

---

### Task 5: macOS 用 userData 记住字号

**Files:**
- Create: `apps/macos/src/main/editor-font-file.ts`
- Create: `apps/macos/src/main/editor-font-file.test.ts`
- Create: `apps/macos/src/renderer/MacApp.test.tsx`
- Modify: `apps/macos/src/shared/macos-api.ts`
- Modify: `apps/macos/src/preload/index.ts`
- Modify: `apps/macos/src/main/index.ts`
- Modify: `apps/macos/src/main/navigation.test.ts`
- Modify: `apps/macos/src/renderer/MacShell.tsx`
- Modify: `apps/macos/src/renderer/MacApp.tsx`
- Test: `apps/macos/src/main/editor-font-file.test.ts`
- Test: `apps/macos/src/renderer/MacApp.test.tsx`

**Interfaces:**
- Consumes: `normalizeEditorFontSize(value: unknown): number`，`messages(locale).fontSaveFailed`，Task 3 的工作台属性
- Produces:
  - `editorFontFilePath(userDataDir: string): string`
  - `readEditorFontFile(userDataDir: string): number`
  - `writeEditorFontFile(userDataDir: string, size: number): void`
  - `writeEditorFontResult(userDataDir: string, size: unknown): { ok: true } | { ok: false }`
  - `JsonbranchApi.readEditorFontSize(): Promise<number>`
  - `JsonbranchApi.writeEditorFontSize(size: number): Promise<{ ok: boolean }>`
  - IPC 通道 `jsonbranch:readEditorFontSize` 和 `jsonbranch:writeEditorFontSize`
  - `MacShell` 增加可选 `editorFontSize?: number` 和 `onEditorFontSize?(size: number): void`，原样传给 `JsonWorkbench`

- [ ] **Step 1: Write the failing test**

创建 `apps/macos/src/main/editor-font-file.test.ts`：

```ts
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  editorFontFilePath,
  readEditorFontFile,
  writeEditorFontFile,
  writeEditorFontResult
} from './editor-font-file'

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), 'jsonbranch-font-'))
}

describe('editor font file', () => {
  it('uses 13 when the file is missing and does not create it', () => {
    const dir = tempDir()
    expect(readEditorFontFile(dir)).toBe(13)
    expect(existsSync(editorFontFilePath(dir))).toBe(false)
  })

  it('uses 13 for corrupt or illegal contents', () => {
    const dir = tempDir()
    const file = editorFontFilePath(dir)
    for (const content of ['not json', '{"fontSize":"13"}', '{"fontSize":13.5}', '{"fontSize":11}', '{"fontSize":25}', '{"input":"{}"}']) {
      writeFileSync(file, content)
      expect(readEditorFontFile(dir)).toBe(13)
    }
  })

  it('stores only the font size and leaves a sibling json file untouched', () => {
    const dir = tempDir()
    const sibling = path.join(dir, 'notes.json')
    writeFileSync(sibling, '{"keep":true}')
    writeEditorFontFile(dir, 18)
    expect(readFileSync(editorFontFilePath(dir), 'utf8')).toBe('{"fontSize":18}\n')
    expect(readEditorFontFile(dir)).toBe(18)
    writeEditorFontFile(dir, 11)
    expect(readFileSync(editorFontFilePath(dir), 'utf8')).toBe('{"fontSize":13}\n')
    expect(readFileSync(sibling, 'utf8')).toBe('{"keep":true}')
  })

  it('reports a failed write without throwing', () => {
    const blocker = path.join(tempDir(), 'not-a-directory')
    writeFileSync(blocker, 'x')
    expect(writeEditorFontResult(blocker, 16)).toEqual({ ok: false })
  })
})
```

创建 `apps/macos/src/renderer/MacApp.test.tsx`：

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JsonbranchApi } from '../shared/macos-api'
import { MacApp } from './MacApp'

afterEach(() => {
  cleanup()
  delete (window as { jsonbranch?: JsonbranchApi }).jsonbranch
})

function useChinese(): void {
  Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'zh-CN' })
}

function installApi(overrides: Partial<JsonbranchApi>): JsonbranchApi {
  const api: JsonbranchApi = {
    openDocument: vi.fn(async () => ({ status: 'canceled' })),
    saveDocument: vi.fn(async () => ({ status: 'denied' })),
    saveDocumentAs: vi.fn(async () => ({ status: 'canceled' })),
    writeClipboard: vi.fn(async () => {}),
    confirmDiscard: vi.fn(async () => 'cancel'),
    onOpenFromOs: () => () => {},
    onRequestSaveClose: () => () => {},
    notifyOsCloseReady: () => {},
    readEditorFontSize: vi.fn(async () => 13),
    writeEditorFontSize: vi.fn(async () => ({ ok: true })),
    ...overrides
  }
  window.jsonbranch = api
  return api
}

describe('MacApp editor font', () => {
  it('restores a valid size and falls back when the read fails', async () => {
    useChinese()
    installApi({ readEditorFontSize: vi.fn(async () => 18) })
    render(<MacApp />)
    expect(await screen.findByRole('button', { name: '增大字号，当前 18', exact: true })).toBeTruthy()
    cleanup()
    useChinese()
    installApi({ readEditorFontSize: vi.fn(async () => { throw new Error('missing') }) })
    render(<MacApp />)
    expect(await screen.findByRole('button', { name: '增大字号，当前 13', exact: true })).toBeTruthy()
  })

  it('keeps the new size visible when the preference write fails and does not save a file', async () => {
    useChinese()
    const api = installApi({
      readEditorFontSize: vi.fn(async () => 13),
      writeEditorFontSize: vi.fn(async () => ({ ok: false }))
    })
    render(<MacApp />)
    fireEvent.click(await screen.findByRole('button', { name: '增大字号，当前 13', exact: true }))
    expect(await screen.findByText('字号未能记在本机')).toBeTruthy()
    expect(screen.getByRole('button', { name: '增大字号，当前 14', exact: true })).toBeTruthy()
    expect(api.saveDocument).not.toHaveBeenCalled()
    expect(api.saveDocumentAs).not.toHaveBeenCalled()
    expect(screen.getByText('未打开的文档')).toBeTruthy()
    expect(screen.queryByText('未存储')).toBeNull()
  })
})
```

在 `apps/macos/src/main/navigation.test.ts` 的方法循环数组末尾增加两个字符串：`'readEditorFontSize'` 和 `'writeEditorFontSize'`。不要删除原有方法。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/macos/src/main/editor-font-file.test.ts apps/macos/src/renderer/MacApp.test.tsx apps/macos/src/main/navigation.test.ts`

Expected: FAIL。`editor-font-file` 模块不存在，`JsonbranchApi` 还没有 `readEditorFontSize`，preload 源码也不含这两个方法名。

- [ ] **Step 3: Write minimal implementation**

创建 `apps/macos/src/main/editor-font-file.ts`：

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { normalizeEditorFontSize } from '@jsonbranch/json-view/editor-font-size'

export function editorFontFilePath(userDataDir: string): string {
  return path.join(userDataDir, 'editor-font-size.json')
}

export function readEditorFontFile(userDataDir: string): number {
  try {
    const parsed: unknown = JSON.parse(readFileSync(editorFontFilePath(userDataDir), 'utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return 13
    }
    return normalizeEditorFontSize((parsed as { fontSize?: unknown }).fontSize)
  } catch {
    return 13
  }
}

export function writeEditorFontFile(userDataDir: string, size: number): void {
  mkdirSync(userDataDir, { recursive: true })
  writeFileSync(editorFontFilePath(userDataDir), `${JSON.stringify({ fontSize: normalizeEditorFontSize(size) })}\n`)
}

export function writeEditorFontResult(userDataDir: string, size: unknown): { ok: true } | { ok: false } {
  try {
    writeEditorFontFile(userDataDir, normalizeEditorFontSize(size))
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
```

这个文件不得导入 `document-io.ts` 或 `saveGrantedJson`。

在 `apps/macos/src/shared/macos-api.ts` 的 `JsonbranchApi` 末尾增加：

```ts
  readEditorFontSize(): Promise<number>
  writeEditorFontSize(size: number): Promise<{ ok: boolean }>
```

把同样两个名字加进 `jsonbranchMethods`。

在 `apps/macos/src/preload/index.ts` 的 `api` 对象里、`notifyOsCloseReady` 之前增加：

```ts
  readEditorFontSize: () => ipcRenderer.invoke('jsonbranch:readEditorFontSize'),
  writeEditorFontSize: (size: number) => ipcRenderer.invoke('jsonbranch:writeEditorFontSize', size),
```

在 `apps/macos/src/main/index.ts` 导入：

```ts
import { readEditorFontFile, writeEditorFontResult } from './editor-font-file'
```

在现有 `jsonbranch:writeClipboard` 处理器之后增加：

```ts
  ipcMain.handle('jsonbranch:readEditorFontSize', () => readEditorFontFile(app.getPath('userData')))
  ipcMain.handle('jsonbranch:writeEditorFontSize', (_event, size: unknown) => writeEditorFontResult(app.getPath('userData'), size))
```

不要改 `createWindow` 的关闭处理、`openDocument`、`saveDocument`、`saveDocumentAs`、`confirmDiscard` 和 `jsonbranch:os-close-ready`。

在 `apps/macos/src/renderer/MacShell.tsx` 的属性类型增加：

```tsx
  editorFontSize?: number
  onEditorFontSize?: (size: number) => void
```

只在传给 `JsonWorkbench` 的属性里增加：

```tsx
        editorFontSize={props.editorFontSize}
        onEditorFontSize={props.onEditorFontSize}
```

不改打开、另存为、关闭按钮和两个对话框的处理函数。

在 `apps/macos/src/renderer/MacApp.tsx` 增加导入：

```tsx
import { messages } from '@jsonbranch/json-view'
import { normalizeEditorFontSize } from '@jsonbranch/json-view/editor-font-size'
```

在 `MacApp` 里、现有 `notice` 状态旁边增加：

```tsx
  const [editorFontSize, setEditorFontSize] = useState(13)
  const [fontNotice, setFontNotice] = useState('')
  const locale = navigator.language.toLowerCase().startsWith('en') ? 'en' : 'zh'
```

把原来传给 `MacShell` 的那行 locale 表达式换成这个 `locale` 变量。增加读取 effect，它只设置状态，不写文件：

```tsx
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
```

在现有 `{notice ? <p role="alert">{notice}</p> : null}` 后面增加：

```tsx
      {fontNotice ? <p role="alert">{fontNotice}</p> : null}
```

`MacShell` 增加：

```tsx
        editorFontSize={editorFontSize}
        onEditorFontSize={(size) => void changeFont(size)}
```

`open`、`save`、`saveAs` 的函数体一个字符都不要改。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run apps/macos/src/main/editor-font-file.test.ts apps/macos/src/renderer/MacApp.test.tsx apps/macos/src/renderer/MacShell.test.tsx apps/macos/src/main/navigation.test.ts apps/macos/src/main/document-io.test.ts apps/macos/src/main/close-gate.test.ts`

Expected: PASS。偏好文件测试 4 个通过。MacApp 字号测试 2 个通过。MacShell 的关闭三按钮、打开另一文件和系统关闭测试仍通过。`document-io` 的未授权写入和 `stale` 测试仍通过。

- [ ] **Step 5: Commit**

```bash
git add apps/macos/src/main/editor-font-file.ts apps/macos/src/main/editor-font-file.test.ts apps/macos/src/renderer/MacApp.test.tsx apps/macos/src/shared/macos-api.ts apps/macos/src/preload/index.ts apps/macos/src/main/index.ts apps/macos/src/main/navigation.test.ts apps/macos/src/renderer/MacShell.tsx apps/macos/src/renderer/MacApp.tsx
git commit -m "feat: remember the macOS editor font size outside the open file"
```

---

### Task 6: 全量核对

**Files:**
- Modify: 只有 Task 5 的测试命令暴露出的类型或测试错误才修改对应文件
- Test: 仓库现有 Vitest 集合、类型检查和扩展端到端测试

**Interfaces:**
- Consumes: Task 1 到 Task 5 的全部导出
- Produces: 无新的公共接口

- [ ] **Step 1: Run the full local checks**

Run: `pnpm exec tsc --noEmit`

Expected: 退出码 0。

Run: `pnpm test`

Expected: 退出码 0。这包含 json-core、json-view、扩展和 macOS 的现有单元测试。

Run: `pnpm build:extension && pnpm test:extension`

Expected: 退出码 0。全页里顶栏按钮没有可见功能名，格式化按钮的 `title` 是「格式化」，刷新后字号仍是 14，正文草稿仍从 `document` 恢复。

不要运行 `pnpm package:mac`。不要运行 `workflow_dispatch`。不要修改 `.github/workflows/release.yml`。

- [ ] **Step 2: Fix only failures from Step 1**

如果失败，只修导致失败的那一处，并重跑失败的那条命令，直到通过。不要顺手改变打开、另存为、关闭，也不要增加自动保存按钮或 macOS 草稿恢复。

- [ ] **Step 3: Commit when Step 2 changed files**

Step 1 全部通过时，不创建空提交。Step 2 改了文件时才提交：

```bash
git add <被修改的文件>
git commit -m "test: align toolbar checks with the icon font controls"
```

---

## 执行说明

按 Task 1 到 Task 6 的顺序执行。每个任务看到的公共名称以该任务的 Interfaces 为准。Task 3 完成前，扩展和 macOS 还没有持久字号；工作台内部状态只保证当时的会话能调节字号。Task 4 和 Task 5 分别把两端接上持久化。

明确不做：不新增「检查是否自动保存」按钮；不把 macOS 未存储的正文写进 userData；不在键入时调用 `saveGrantedJson`；不改 Orca；不改发布工作流。
