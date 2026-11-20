# 枝序 JSONBranch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 执行时按任务做 TDD，每个任务完成后审查，再进入下一任务。本文件不授权修改 Orca。

**Goal:** 在空的公开仓库 `yongwuzhijin/jsonbranch` 里做出枝序：一份 JSON 核心和界面，同时装进 Chrome Manifest V3 全页扩展和 macOS Electron 应用。第一版只处理手动粘贴和本地文件，不改写网页。

**Architecture:** `packages/json-core` 没有 React、Chrome 和 Electron。`packages/json-view` 接收文本槽和复制回调。扩展用 `chrome.storage.local` 保存文本。macOS 应用用窗口授权表和原子写盘保存 `.json`。Monaco worker 启动失败时，同一份 `input` 改用 textarea。

**Tech Stack:** `jsonc-parser` `3.3.1`，`monaco-editor` `0.55.1`，`@monaco-editor/react` `4.7.0`，`@tanstack/react-virtual` `3.14.13`，React `19.2.8`，Electron `43.7.5`，electron-builder `26.15.3`，`lucide-react` `0.577.0`，Vitest `5.0.3`，TypeScript `5.9.3`。

本文在目标仓库中的路径：`docs/superpowers/plans/2026-11-19-jsonbranch.md`。设计依据是 `docs/superpowers/specs/2026-11-19-jsonbranch-design.md`。

## Global Constraints

下列约束对每个任务生效：

- 产品名是枝序，英文名是 JSONBranch。macOS bundle id 是 `app.jsonbranch.macos`。
- 源码边界是 Orca 提交 `73fd1d0329c15ee5b3faf1fa76dea91fd764c281`。格式化器来自该提交内的 `ade872d146` 与 `528112a42a`。Orca 仓库保持不变。
- `LICENSE` 原样保留 “Copyright (c) 2026 Lovecast Inc.” 的 MIT 声明。`NOTICE` 写明派生自 https://github.com/stablyai/orca 和 https://github.com/yongwuzhijin/orca 。
- 依赖版本按 Tech Stack 锁定。`lucide-react` 是 ISC，其余列出的运行时包按设计说明为 MIT。实现时把包内许可证文本写入 `NOTICE`。
- 第一版手动粘贴。没有 content script，不读取浏览页面，不按网址格式化。
- Chrome 扩展是 Manifest V3。点击图标打开完整标签页。`permissions` 只有 `["storage"]`。不写 `host_permissions`、`content_scripts`、`sandbox` 和 `default_popup`。
- 扩展页 CSP 是 `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self'`。
- 完全离线，无统计，无自动更新。
- 界面中文优先并提供英文。系统语言以 `zh` 开头用中文，以 `en` 开头用英文，其余用中文。
- 直接分发。不上架 Chrome 网上应用店，不提交 Mac App Store，不做沙箱。
- 签名只用 `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`、`CSC_LINK`、`CSC_KEY_PASSWORD`。五项都非空才签名并公证。缺任何一项就产出未签名包。配置中不出现 `6CX3WHS9HZ`、`com.yongwuzhijin.dmonwork`、`DmonWork`。
- 解析上限是 `5 * 1024 * 1024` 个 UTF-16 码元。macOS 打开上限是 20 MiB。重复键保留后出现的值。
- macOS 渲染进程 `contextIsolation: true`，`nodeIntegration: false`，`sandbox: true`，`webSecurity: true`。
- 一个 macOS 窗口一份文档。一个扩展标签页一份粘贴文档。

## 前提（执行前的检查点，不是已完成的构建）

1. 协调者在用户完成浏览器登录后创建公开仓库 https://github.com/yongwuzhijin/jsonbranch 。本计划不创建仓库。
2. 执行者把本计划提交到 `docs/superpowers/plans/2026-11-19-jsonbranch.md`，把已批准的设计说明提交到 `docs/superpowers/specs/2026-11-19-jsonbranch-design.md`。
3. 只读检出 Orca 到 `ORCA_SRC`，`git -C "$ORCA_SRC" rev-parse HEAD` 必须是 `73fd1d0329c15ee5b3faf1fa76dea91fd764c281`。
4. GitHub Actions 能排队。macOS dmg 需要 `macos-14` 或更新的托管 runner。本计划不声称包已经打出。
5. Apple 五项密钥可选。没有密钥时仍上传未签名 arm64 与 x64 产物。
6. 未签名 app 在其他 Mac 上通常会被 Gatekeeper 拦住。接收者可以在系统设置或 Finder 的「打开」里明确同意后运行。没有公证的包不是双击即开的正式安装包。
7. 扩展的 Playwright 测试需要本机 Chrome。没装 Chrome 时该测试命令失败，不能改成跳过并宣称通过。人工验收只要求 macOS 上的 Chrome。
8. Monaco `0.55.1` 在上述 CSP 下能否创建 worker，要由 Task 8 的真实扩展页决定。两种合法结果是 Monaco 可用，或 textarea 降级可用。空白编辑区不合格。

## 文件职责

| 路径 | 职责 |
| --- | --- |
| `packages/json-core/src/parse-json-input.ts` | 从 Orca 复制的解析 |
| `packages/json-core/src/json-unescape.ts` | 从 Orca 复制的反转义 |
| `packages/json-core/src/json-path.ts` | 路径 |
| `packages/json-core/src/json-tree-rows.ts` | 可见行 |
| `packages/json-core/src/json-tree-expansion.ts` | 展开状态 |
| `packages/json-core/src/json-search.ts` | 搜索 |
| `packages/json-core/src/json-delete-node.ts` | 删除节点 |
| `packages/json-core/src/json-copy-text.ts` | 复制文本 |
| `packages/json-core/src/json-document.ts` | 格式化、删除、撤销、脏标记 |
| `packages/json-core/src/json-parse-error-message.ts` | 中英错误 |
| `packages/json-view/src/JsonWorkbench.tsx` | 工具栏、分栏、树、搜索 |
| `packages/json-view/src/TextSlot.tsx` | Monaco，失败则 textarea |
| `apps/extension/manifest.json` | MV3 清单 |
| `apps/extension/src/background.ts` | 打开或聚焦标签 |
| `apps/extension/src/storage.ts` | `chrome.storage.local` 文档 |
| `apps/macos/src/main/document-io.ts` | `.json` 授权、原子写 |
| `apps/macos/src/preload/index.ts` | 冻结的 `window.jsonbranch` |
| `electron-builder.yml` | 双架构 dmg 与 zip |
| `.github/workflows/release.yml` | 扩展 zip、可选签名、人工烟雾门 |
| `README.md` | 加载未打包扩展、未签名限制 |

## 抽取映射

从 `ORCA_SRC/src/renderer/src/components/json-formatter/` 原样复制到 `packages/json-core/src/`：

`parse-json-input.ts`，`json-unescape.ts`，`json-path.ts`，`json-row-text.ts`，`json-tree-rows.ts`，`json-tree-expansion.ts`，`json-search.ts`，`json-delete-node.ts`，`json-copy-text.ts`，`json-formatter-split-ratio.ts`。

不复制 `json-formatter-tab.ts`，因为它依赖工作区 id 和 `translate()`。不复制任何 `.tsx`。错误文案在新的 `json-parse-error-message.ts` 重写，不调用 Orca 的 i18n。

---

### Task 1: 仓库身份

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `LICENSE`
- Create: `NOTICE`
- Create: `packages/json-core/package.json`
- Create: `src/shared/locale.ts`
- Create: `src/shared/signing.ts`
- Test: `src/shared/identity.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `chooseLocale(language: string): 'zh' | 'en'`
  - `signingEnabled(env: Record<string, string | undefined>): boolean`
  - 根包名 `jsonbranch`。工作区包含 `packages/*` 和 `apps/*`。

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { chooseLocale } from './locale'
import { signingEnabled } from './signing'

describe('jsonbranch identity', () => {
  it('chooses Chinese unless the language starts with en', () => {
    expect(chooseLocale('zh-Hans')).toBe('zh')
    expect(chooseLocale('en')).toBe('en')
    expect(chooseLocale('fr')).toBe('zh')
  })

  it('pins the parser and does not sign with a partial secret set', () => {
    expect(readFileSync('packages/json-core/package.json', 'utf8')).toContain('"jsonc-parser": "3.3.1"')
    const full = {
      APPLE_ID: 'a',
      APPLE_APP_SPECIFIC_PASSWORD: 'b',
      APPLE_TEAM_ID: 'c',
      CSC_LINK: 'd',
      CSC_KEY_PASSWORD: 'e'
    }
    expect(signingEnabled(full)).toBe(true)
    expect(signingEnabled({ ...full, CSC_LINK: '' })).toBe(false)
  })

  it('keeps the MIT notice and both Orca URLs', () => {
    expect(readFileSync('LICENSE', 'utf8')).toContain('Copyright (c) 2026 Lovecast Inc.')
    const notice = readFileSync('NOTICE', 'utf8')
    expect(notice).toContain('https://github.com/stablyai/orca')
    expect(notice).toContain('https://github.com/yongwuzhijin/orca')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/shared/identity.test.ts`

Expected: FAIL，`./locale` 不存在。

- [ ] **Step 3: Write minimal implementation**

`chooseLocale` 与 `signingEnabled` 的规则和叶笺相同：`en` 前缀为英文，其余为中文；五个密钥去空白后都非空才签名。`LICENSE` 从 `$ORCA_SRC/LICENSE` 原样复制。`NOTICE` 写明格式化器派生自锁定提交。`packages/json-core/package.json` 的 `name` 是 `@jsonbranch/json-core`，依赖只有 `jsonc-parser` `3.3.1`。`packages/json-view/package.json` 的 `name` 是 `@jsonbranch/json-view`，依赖 `@jsonbranch/json-core`、React `19.2.8` 和 `@tanstack/react-virtual` `3.14.13`。根 `package.json` 把 React、Monaco、Electron 和 electron-builder 写成 Tech Stack 中的精确版本。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/shared/identity.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml LICENSE NOTICE packages/json-core/package.json src/shared
git commit -m "feat: pin JSONBranch identity and licenses"
```

### Task 2: 解析、反转义和重复键

**Files:**
- Create: `packages/json-core/src/parse-json-input.ts`
- Create: `packages/json-core/src/json-unescape.ts`
- Test: `packages/json-core/src/parse-json-input.test.ts`

**Interfaces:**
- Consumes: `jsonc-parser` 的 `parse` 与 `printParseErrorCode`
- Produces:
  - `MAX_JSON_INPUT_CHARS = 5 * 1024 * 1024`
  - `type JsonParseErrorCode = 'too-large' | 'too-deep' | 'unexpected-end' | 'invalid-symbol' | 'invalid-number' | 'invalid-escape' | 'comments-not-allowed' | 'trailing-content' | 'syntax'`
  - `type JsonParseResult = { status: 'empty' } | { status: 'ok'; value: unknown } | { status: 'error'; code: JsonParseErrorCode; line: number; column: number }`
  - `parseJsonInput(input: string, options: { keepEscapes: boolean }): JsonParseResult`
  - `unescapeJsonText(text: string): string`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { MAX_JSON_INPUT_CHARS, parseJsonInput } from './parse-json-input'

describe('parseJsonInput', () => {
  it('keeps the last duplicate key', () => {
    expect(parseJsonInput('{"a":1,"a":2}', { keepEscapes: true })).toEqual({ status: 'ok', value: { a: 2 } })
  })

  it('parses an escaped pasted object only when keepEscapes is false', () => {
    const pasted = '"{\\"a\\":1}"'
    expect(parseJsonInput(pasted, { keepEscapes: true }).status).toBe('error')
    expect(parseJsonInput(pasted, { keepEscapes: false })).toEqual({ status: 'ok', value: { a: 1 } })
  })

  it('rejects comments and reports invalid escapes', () => {
    expect(parseJsonInput('{ /* x */ }', { keepEscapes: true })).toMatchObject({ status: 'error', code: 'comments-not-allowed' })
    expect(parseJsonInput('"\\q"', { keepEscapes: true })).toMatchObject({ status: 'error', code: 'invalid-escape' })
  })

  it('returns too-large and too-deep without throwing', () => {
    expect(parseJsonInput('a'.repeat(MAX_JSON_INPUT_CHARS + 1), { keepEscapes: true })).toMatchObject({ status: 'error', code: 'too-large' })
    expect(parseJsonInput(`${'['.repeat(100_000)}${']'.repeat(100_000)}`, { keepEscapes: true })).toMatchObject({ status: 'error', code: 'too-deep' })
    expect(parseJsonInput('   ', { keepEscapes: true })).toEqual({ status: 'empty' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/json-core/src/parse-json-input.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: Write minimal implementation**

从抽取映射原样复制这两个文件。不改解析阈值、`disallowComments: true` 和 `allowTrailingComma: false`。Task 4 增加 `packages/json-core/src/index.ts`，导出 `parseJsonInput`、`MAX_JSON_INPUT_CHARS`、`createJsonDocument`、`applyFormat`、`applyDelete`、`applyUndo`、`applyInput`、`isDirty`、`describeJsonParseError`、`buildVisibleJsonRows`、`createJsonExpansion`、`findJsonMatches`、`deleteJsonNodeAt`、`toCopyablePath`、`buildJsonPairText`、`buildJsonValueText` 和类型 `JsonDocument`、`JsonParseResult`、`JsonTreeRow`、`JsonSearchMatch`。`package.json` 的 `exports` 指向这个文件。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/json-core/src/parse-json-input.test.ts`

Expected: PASS。`too-deep` 用例若在 10 万层之前就返回 `too-deep`，断言仍是 `code: 'too-deep'` 且进程不退出。

- [ ] **Step 5: Commit**

```bash
git add packages/json-core/src/parse-json-input.ts packages/json-core/src/json-unescape.ts packages/json-core/src/parse-json-input.test.ts
git commit -m "feat: parse JSON with the Orca size and escape rules"
```

### Task 3: 树、搜索、删除和复制

**Files:**
- Create: `packages/json-core/src/json-path.ts`
- Create: `packages/json-core/src/json-row-text.ts`
- Create: `packages/json-core/src/json-tree-rows.ts`
- Create: `packages/json-core/src/json-tree-expansion.ts`
- Create: `packages/json-core/src/json-search.ts`
- Create: `packages/json-core/src/json-delete-node.ts`
- Create: `packages/json-core/src/json-copy-text.ts`
- Create: `packages/json-core/src/json-formatter-split-ratio.ts`
- Test: `packages/json-core/src/json-tree.test.ts`

**Interfaces:**
- Consumes: `parseJsonInput`
- Produces:
  - `appendJsonObjectKey(parentPath: string, key: string): string`
  - `appendJsonArrayIndex(parentPath: string, index: number): string`
  - `toCopyablePath(path: string): string`
  - `buildVisibleJsonRows(value: unknown, expansion: JsonExpansionState): JsonTreeRow[]`
  - `findJsonMatches(value: unknown, query: string): JsonSearchMatch[]`
  - `deleteJsonNodeAt(value: unknown, segments: readonly (string | number)[]): unknown`
  - `buildJsonPairText(row: JsonTreeRow): string`
  - `buildJsonValueText(row: JsonTreeRow): string`
  - `type JsonTreeRow = { path: string; segments: readonly (string | number)[]; depth: number; kind: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'; label: string | null; labelKind: 'key' | 'index' | null; value: unknown; childCount: number; isExpandable: boolean; isCollapsed: boolean }`
  - `type JsonSearchMatch = { path: string; field: 'key' | 'value'; start: number; end: number }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { buildJsonPairText, buildJsonValueText } from './json-copy-text'
import { deleteJsonNodeAt } from './json-delete-node'
import { toCopyablePath } from './json-path'
import { findJsonMatches } from './json-search'
import { createJsonExpansion } from './json-tree-expansion'
import { buildVisibleJsonRows } from './json-tree-rows'

describe('json tree', () => {
  it('uses dot paths for identifiers and brackets for odd keys', () => {
    const rows = buildVisibleJsonRows({ ok: 1, 'a b': 2 }, createJsonExpansion())
    expect(rows.map((row) => row.path)).toContain('ok')
    expect(rows.map((row) => row.path)).toContain('["a b"]')
    expect(toCopyablePath('')).toBe('$')
  })

  it('searches keys and values without case sensitivity', () => {
    const matches = findJsonMatches({ Name: 'Beta' }, 'name')
    expect(matches.some((match) => match.field === 'key')).toBe(true)
    expect(findJsonMatches({ Name: 'Beta' }, 'beta').some((match) => match.field === 'value')).toBe(true)
  })

  it('deletes one node and can describe the removed pair', () => {
    const rows = buildVisibleJsonRows({ a: 1, b: 2 }, createJsonExpansion())
    const row = rows.find((item) => item.path === 'a')
    expect(row).toBeTruthy()
    expect(deleteJsonNodeAt({ a: 1, b: 2 }, row!.segments)).toEqual({ b: 2 })
    expect(buildJsonPairText(row!)).toContain('"a"')
    expect(buildJsonValueText(row!)).toBe('1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/json-core/src/json-tree.test.ts`

Expected: FAIL，`buildVisibleJsonRows` 未定义。

- [ ] **Step 3: Write minimal implementation**

按抽取映射原样复制这 8 个文件。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/json-core/src/json-tree.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/json-core/src
git commit -m "feat: add the searchable JSON tree core"
```

### Task 4: 文档模型、错误文案、格式化和撤销

**Files:**
- Create: `packages/json-core/src/json-document.ts`
- Create: `packages/json-core/src/json-parse-error-message.ts`
- Create: `packages/json-core/src/index.ts`
- Test: `packages/json-core/src/json-document.test.ts`

**Interfaces:**
- Consumes: `parseJsonInput`，`deleteJsonNodeAt`，`chooseLocale`
- Produces:
  - `type JsonDocument = { input: string; baseline: string; keepEscapes: boolean; showLineNumbers: boolean; undoInput: string | null }`
  - `createJsonDocument(input?: string): JsonDocument`
  - `applyFormat(document: JsonDocument): JsonDocument`
  - `applyDelete(document: JsonDocument, segments: readonly (string | number)[]): JsonDocument`
  - `applyUndo(document: JsonDocument): JsonDocument`
  - `applyInput(document: JsonDocument, input: string): JsonDocument`
  - `isDirty(document: JsonDocument): boolean`
  - `describeJsonParseError(result: Extract<JsonParseResult, { status: 'error' }>, locale: 'zh' | 'en'): string`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { applyDelete, applyFormat, applyUndo, createJsonDocument, isDirty } from './json-document'
import { describeJsonParseError } from './json-parse-error-message'
import { parseJsonInput } from './parse-json-input'
import { buildVisibleJsonRows } from './json-tree-rows'
import { createJsonExpansion } from './json-tree-expansion'

describe('json document', () => {
  it('formats with two spaces and becomes dirty', () => {
    const next = applyFormat(createJsonDocument('{"a":1}'))
    expect(next.input).toBe('{\n  "a": 1\n}')
    expect(isDirty(next)).toBe(true)
  })

  it('restores the exact input after one undo', () => {
    const start = createJsonDocument('{"a":1,"b":2}')
    const parsed = parseJsonInput(start.input, { keepEscapes: true })
    const row = buildVisibleJsonRows(parsed.status === 'ok' ? parsed.value : null, createJsonExpansion()).find((item) => item.path === 'a')
    const deleted = applyDelete(start, row!.segments)
    expect(applyUndo(deleted).input).toBe(start.input)
  })

  it('describes a comment error with a line number in Chinese', () => {
    const result = parseJsonInput('{ /* x */ }', { keepEscapes: true })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(describeJsonParseError(result, 'zh')).toContain('注释')
      expect(describeJsonParseError(result, 'zh')).toContain(String(result.line))
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/json-core/src/json-document.test.ts`

Expected: FAIL，`createJsonDocument` 未定义。

- [ ] **Step 3: Write minimal implementation**

`createJsonDocument` 的默认 `input` 是 `''`，`keepEscapes` 是 `true`，`showLineNumbers` 是 `false`，`baseline` 等于 `input`，`undoInput` 是 `null`。`applyFormat` 在解析不是 `ok` 时返回原对象；是 `ok` 时把 `input` 设为 `JSON.stringify(value, null, 2)`。`applyDelete` 先解析，失败则原样返回；成功则把当前 `input` 存进 `undoInput`，新 `input` 是 `JSON.stringify(deleteJsonNodeAt(value, segments), null, 2)`。`applyUndo` 在 `undoInput` 为 `null` 时原样返回，否则把 `input` 设回它并清空 `undoInput`。`applyInput` 改 `input` 且清空 `undoInput`。`isDirty` 比较 `input` 与 `baseline`。错误中文：`too-large` 内容过大，无法预览；`too-deep` JSON 嵌套过深，无法预览；`comments-not-allowed` JSON 中不允许注释；其余代码使用「JSON 无效」，并在有行列时追加「第 N 行，第 M 列」。`too-large` 与 `too-deep` 不追加行列。英文对应：Content is too large to preview.；JSON is nested too deeply to preview.；Comments are not allowed in JSON.；Invalid JSON.；Line N, column M.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/json-core/src/json-document.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/json-core/src/json-document.ts packages/json-core/src/json-parse-error-message.ts packages/json-core/src/json-document.test.ts
git commit -m "feat: format, delete, and undo one JSON document"
```

### Task 5: 共享工作台

**Files:**
- Create: `packages/json-view/package.json`
- Create: `packages/json-view/src/JsonWorkbench.tsx`
- Create: `packages/json-view/src/json-view-model.ts`
- Test: `packages/json-view/src/JsonWorkbench.test.tsx`

**Interfaces:**
- Consumes: `JsonDocument`，`applyFormat`，`applyDelete`，`applyUndo`，`findJsonMatches`，`buildVisibleJsonRows`，`describeJsonParseError`
- Produces:
  - `type TextSlotProps = { value: string; onChange(value: string): void }`
  - `type CopyText = (text: string) => Promise<void>`
  - `JsonWorkbench(props: { document: JsonDocument; locale: 'zh' | 'en'; TextSlot: (props: TextSlotProps) => JSX.Element; copyText: CopyText; onDocument(document: JsonDocument): void }): JSX.Element`
  - `searchState(value: unknown, query: string, index: number): { count: number; active: JsonSearchMatch | null }`

- [ ] **Step 1: Write the failing test**

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createJsonDocument, type JsonDocument } from '@jsonbranch/json-core'
import { JsonWorkbench } from './JsonWorkbench'

afterEach(() => cleanup())

function Host({ copyText }: { copyText: (text: string) => Promise<void> }) {
  const [document, setDocument] = useState<JsonDocument>(createJsonDocument('{"name":"Beta"}'))
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/json-view/src/JsonWorkbench.test.tsx`

Expected: FAIL，`JsonWorkbench` 未定义。

- [ ] **Step 3: Write minimal implementation**

`JsonWorkbench` 不导入 Monaco、Chrome 或 Electron。文本槽只渲染 `props.TextSlot`。格式化按钮调用 `applyFormat` 后 `onDocument`。搜索框 `role="searchbox"`。匹配数用 `findJsonMatches`。当前匹配调用 `expandJsonAncestors`。复制路径按钮对当前行调用 `copyText(toCopyablePath(row.path))`。空解析显示「没有内容」和英文 `Nothing to show`。错误显示 `describeJsonParseError`。删除按钮调用 `applyDelete`。撤销按钮调用 `applyUndo`。这些按钮都不调用文件或网络 API。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/json-view/src/JsonWorkbench.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/json-view
git commit -m "feat: share the JSON workbench between hosts"
```

### Task 6: Monaco 槽和 textarea 降级

**Files:**
- Create: `packages/json-view/src/TextSlot.tsx`
- Create: `packages/json-view/src/monaco-environment.ts`
- Test: `packages/json-view/src/TextSlot.test.tsx`

**Interfaces:**
- Consumes: `TextSlotProps`
- Produces:
  - `createJsonWorker(): Worker`
  - `TextSlot(props: TextSlotProps & { createWorker?: () => Worker }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TextSlot } from './TextSlot'

afterEach(() => cleanup())

describe('TextSlot', () => {
  it('uses a textarea when the worker constructor throws EvalError', () => {
    render(<TextSlot value="{}" onChange={() => {}} createWorker={() => { throw new EvalError('csp') }} />)
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA')
  })

  it('keeps the same value through the fallback', () => {
    const seen: string[] = []
    render(<TextSlot value="{}" onChange={(value) => seen.push(value)} createWorker={() => { throw new EvalError('csp') }} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"a":1}' } })
    expect(seen).toEqual(['{"a":1}'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/json-view/src/TextSlot.test.tsx`

Expected: FAIL，`TextSlot` 未定义。

- [ ] **Step 3: Write minimal implementation**

`createJsonWorker` 执行 `new Worker(new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url), { type: 'module' })`。编辑器 worker 同样用包内 `editor.worker.js`。`TextSlot` 在渲染前调用 `createWorker`；抛出 `EvalError` 或 `SecurityError` 时渲染 `<textarea role="textbox">`，值为 `props.value`。成功时渲染 `@monaco-editor/react` 的 `Editor`，并先执行 `loader.config({ monaco })`，其中 `monaco` 来自 `import * as monaco from 'monaco-editor'`。不设置 CDN URL。构建配置禁止 `worker.format: 'iife'` 和 blob worker。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/json-view/src/TextSlot.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/json-view/src/TextSlot.tsx packages/json-view/src/monaco-environment.ts packages/json-view/src/TextSlot.test.tsx
git commit -m "feat: fall back to a textarea when Monaco workers are blocked"
```

### Task 7: 扩展清单、标签和本地存储

**Files:**
- Create: `apps/extension/manifest.json`
- Create: `apps/extension/src/background.ts`
- Create: `apps/extension/src/storage.ts`
- Create: `apps/extension/src/viewer.tsx`
- Test: `apps/extension/src/extension-contract.test.ts`

**Interfaces:**
- Consumes: `JsonDocument`，`createJsonDocument`
- Produces:
  - `type StoredDocument = { input: string; keepEscapes: boolean; showLineNumbers: boolean }`
  - `loadStoredDocument(area: StorageArea): Promise<StoredDocument>`
  - `saveStoredDocument(area: StorageArea, document: StoredDocument): Promise<void>`
  - `openViewer(chromeApi: ChromeTabs, session: SessionArea): Promise<void>`
  - `type StorageArea = { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> }`
  - `type SessionArea = { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> }`
  - `type ChromeTabs = { create(url: string): Promise<{ id: number }>; update(id: number, active: true): Promise<void> }`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { loadStoredDocument, saveStoredDocument } from './storage'
import { openViewer } from './background'

describe('extension contract', () => {
  it('requests only storage and opens a full tab', () => {
    const manifest = JSON.parse(readFileSync('apps/extension/manifest.json', 'utf8'))
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.permissions).toEqual(['storage'])
    expect(manifest.host_permissions).toBeUndefined()
    expect(manifest.content_scripts).toBeUndefined()
    expect(manifest.action.default_popup).toBeUndefined()
    expect(manifest.content_security_policy.extension_pages).toBe("script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self'")
  })

  it('restores an empty document and focuses an existing tab id', async () => {
    const area = { get: async () => undefined, set: vi.fn(async () => {}) }
    expect(await loadStoredDocument(area)).toEqual({ input: '', keepEscapes: true, showLineNumbers: false })
    const tabs = { create: vi.fn(async () => ({ id: 7 })), update: vi.fn(async () => {}) }
    const session = { get: async () => 7, set: vi.fn(async () => {}) }
    await openViewer(tabs, session)
    expect(tabs.update).toHaveBeenCalledWith(7, true)
    expect(tabs.create).not.toHaveBeenCalled()
    await saveStoredDocument(area, { input: '{}', keepEscapes: true, showLineNumbers: false })
    expect(area.set).toHaveBeenCalledWith('document', { input: '{}', keepEscapes: true, showLineNumbers: false })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/extension/src/extension-contract.test.ts`

Expected: FAIL，`manifest.json` 不存在。

- [ ] **Step 3: Write minimal implementation**

`manifest.json` 按测试写死。`background.ts` 的 `openViewer` 读 `session.get('viewerTabId')`。数字 id 先 `tabs.update`；抛错再 `tabs.create(chrome.runtime.getURL('viewer.html'))` 并把 id 写入 session。测试里的 `ChromeTabs.create` 接收完整 URL 字符串，生产代码传入 `chrome.runtime.getURL('viewer.html')`。`loadStoredDocument` 缺记录时返回空文档默认值。`saveStoredDocument` 只写键 `document` 的这三项。`viewer.tsx` 把存储接到 `JsonWorkbench`，复制用 `navigator.clipboard.writeText`；失败时选中一段隐藏 textarea 里的文本并显示「复制失败」。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run apps/extension/src/extension-contract.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/extension
git commit -m "feat: open the JSON tool in a full Chrome tab"
```

### Task 8: 真实 Chrome 页的检查点

**Files:**
- Create: `apps/extension/playwright.config.ts`
- Create: `apps/extension/viewer.e2e.ts`
- Modify: `package.json` 脚本 `test:extension`

**Interfaces:**
- Consumes: Task 7 的 `apps/extension/dist`
- Produces: 命令 `pnpm exec playwright test --config apps/extension/playwright.config.ts`。它启动本机 Chrome，加载未打包目录。

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from '@playwright/test'

test('full tab formats pasted JSON without content scripts', async ({ page, context }) => {
  const background = context.serviceWorkers()[0]
  expect(background).toBeTruthy()
  await page.goto(page.url())
  expect(page.url()).toContain('chrome-extension://')
  await page.getByRole('textbox').fill('{"name":"Beta"}')
  await page.getByRole('button', { name: '格式化' }).click()
  await expect(page.getByRole('textbox')).toHaveValue('{\n  "name": "Beta"\n}')
  await page.reload()
  await expect(page.getByRole('textbox')).toHaveValue('{\n  "name": "Beta"\n}')
})
```

`playwright.config.ts` 使用 `channel: 'chrome'`，`args: ['--disable-extensions-except=apps/extension/dist', '--load-extension=apps/extension/dist']`。没有这些参数时测试不能手工改成通过。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test:extension`

Expected: FAIL，直到 `apps/extension/dist` 存在且 Chrome 已安装。Chrome 不存在时的失败信息是浏览器可执行文件缺失。这是检查点，不把失败改成跳过。

- [ ] **Step 3: Write minimal implementation**

添加构建脚本，用 Vite 库模式把 `viewer.tsx` 和 `background.ts` 输出到 `apps/extension/dist`，worker 为单独文件。`viewer.e2e.ts` 在打开扩展页后断言页面 URL 的协议是 `chrome-extension:`，并且 `dist/manifest.json` 没有 `content_scripts`。网络监听若看到非扩展来源请求，测试失败。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test:extension`

Expected: 在装有 Chrome 的机器上 PASS。没装 Chrome 的环境保持 FAIL，发布说明不得写成已通过。

- [ ] **Step 5: Commit**

```bash
git add apps/extension/playwright.config.ts apps/extension/viewer.e2e.ts package.json
git commit -m "test: load the unpacked extension in Chrome"
```

### Task 9: macOS 文件、脏状态和窄 IPC

**Files:**
- Create: `apps/macos/src/shared/macos-api.ts`
- Create: `apps/macos/src/main/document-io.ts`
- Create: `apps/macos/src/main/ipc-handlers.ts`
- Create: `apps/macos/src/main/navigation.ts`
- Create: `apps/macos/src/preload/index.ts`
- Create: `apps/macos/src/renderer/MacShell.tsx`
- Test: `apps/macos/src/main/document-io.test.ts`
- Test: `apps/macos/src/renderer/MacShell.test.tsx`

**Interfaces:**
- Consumes: `JsonDocument`，`isDirty`，`applyInput`
- Produces:
  - `type MacFileStamp = { mtimeMs: number; size: number }`
  - `type MacOpenResult = { status: 'canceled' } | { status: 'error'; reason: 'not-file' | 'bad-extension' | 'not-utf8' | 'too-large' } | { status: 'ok'; path: string; content: string; stamp: MacFileStamp }`
  - `type MacSaveResult = { status: 'ok'; path: string; stamp: MacFileStamp } | { status: 'unchanged' } | { status: 'stale' } | { status: 'denied' } | { status: 'failed'; message: string }`
  - `inspectJsonOpen(input: { absolutePath: string; bytes: Uint8Array; isFile: boolean; stamp: MacFileStamp }): MacOpenResult`
  - `planJsonWrite(input: { granted: boolean; current: MacFileStamp | null; baseline: MacFileStamp; next: string; previous: string; overwrite: boolean }): { action: 'skip' | 'stale' | 'denied' } | { action: 'write'; bytes: Uint8Array }`
  - `MacShell(props: { path: string | null; initial: string; locale: 'zh' | 'en'; save: (content: string) => Promise<MacSaveResult> }): JSX.Element`
  - `window.leafnote` 不在这个应用出现。preload 冻结的对象名是 `window.jsonbranch`，方法只有 `openDocument`，`saveDocument`，`saveDocumentAs`，`writeClipboard`，`confirmDiscard`，`onOpenFromOs`。

- [ ] **Step 1: Write the failing test**

`apps/macos/src/main/document-io.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { inspectJsonOpen, planJsonWrite } from './document-io'

describe('mac json files', () => {
  it('loads invalid json and refuses a file over 20 MiB', () => {
    const opened = inspectJsonOpen({
      absolutePath: '/a.json',
      bytes: new TextEncoder().encode('{'),
      isFile: true,
      stamp: { mtimeMs: 1, size: 1 }
    })
    expect(opened).toMatchObject({ status: 'ok', content: '{' })
    const huge = new Uint8Array(20 * 1024 * 1024 + 1)
    expect(inspectJsonOpen({
      absolutePath: '/a.json',
      bytes: huge,
      isFile: true,
      stamp: { mtimeMs: 1, size: huge.byteLength }
    })).toMatchObject({ status: 'error', reason: 'too-large' })
  })

  it('does not write unchanged text', () => {
    expect(planJsonWrite({
      granted: true,
      current: { mtimeMs: 1, size: 1 },
      baseline: { mtimeMs: 1, size: 1 },
      next: '{',
      previous: '{',
      overwrite: false
    })).toEqual({ action: 'skip' })
  })
})
```

`apps/macos/src/renderer/MacShell.test.tsx`：

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MacShell } from './MacShell'

afterEach(() => cleanup())

describe('MacShell', () => {
  it('asks before closing a dirty buffer and stays on cancel', () => {
    render(
      <MacShell
        path="/a.json"
        initial={'{'}
        locale="zh"
        save={async () => ({ status: 'ok', path: '/a.json', stamp: { mtimeMs: 2, size: 2 } })}
      />
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"a":1}' } })
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.getByRole('button', { name: '存储' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.getByDisplayValue('{"a":1}')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/macos/src/main/document-io.test.ts apps/macos/src/renderer/MacShell.test.tsx`

Expected: FAIL，模块不存在。

- [ ] **Step 3: Write minimal implementation**

`inspectJsonOpen` 只接受扩展名 `.json`，UTF-8 用 `TextDecoder` 的 `fatal: true`，超过 20 MiB 返回 `too-large`，不截断。5 MiB 码元以上仍返回 `ok`，界面再显示解析错误。`planJsonWrite` 与叶笺的 `planWrite` 同规则，但比较的是字符串，写入时编码成 UTF-8。`writeFileAtomic` 在同目录写临时文件，`fsync` 后 `rename`。`MacShell` 把 `initial` 放进 `createJsonDocument`，`baseline` 设为 `initial`。关闭按钮在 `isDirty` 时显示「存储」「不存储」「取消」。取消留在当前文本。不存储调用关闭且不调用 `save`。存储调用 `save`，只有返回 `ok` 才关闭。`stale` 时再问「覆盖」「取消」。preload 与 `windowSecurityOptions` 和叶笺的安全四元组相同，通道只有列出的六个。`onBeforeRequest` 取消非 `app:` 请求。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run apps/macos/src/main/document-io.test.ts apps/macos/src/renderer/MacShell.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/macos
git commit -m "feat: open and save local JSON without a second parser"
```

### Task 10: 扩展 zip、双架构 macOS 包和 README

**Files:**
- Create: `electron-builder.yml`
- Create: `entitlements.mac.plist`
- Create: `.github/workflows/release.yml`
- Create: `README.md`
- Test: `src/shared/release-contract.test.ts`

**Interfaces:**
- Consumes: `signingEnabled`
- Produces: 产物名 `JSONBranch-macos-arm64.dmg`，`JSONBranch-macos-arm64.zip`，`JSONBranch-macos-x64.dmg`，`JSONBranch-macos-x64.zip`，以及 `jsonbranch-chrome.zip`。工作流矩阵是 `arch: [arm64, x64]`。`smoke` 与 `chrome-smoke` 只在 `workflow_dispatch` 中出现。

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('jsonbranch release contract', () => {
  it('publishes both mac arches and an unpacked extension zip', () => {
    const builder = readFileSync('electron-builder.yml', 'utf8')
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8')
    const readme = readFileSync('README.md', 'utf8')
    expect(builder).toContain('appId: app.jsonbranch.macos')
    expect(builder).toContain('JSONBranch-macos-arm64')
    expect(builder).toContain('JSONBranch-macos-x64')
    expect(builder).not.toContain('6CX3WHS9HZ')
    expect(workflow).toContain('arch: [arm64, x64]')
    expect(workflow).toContain('jsonbranch-chrome.zip')
    expect(workflow).toContain('workflow_dispatch')
    expect(readme).toContain('加载未打包的扩展程序')
    expect(readme).toContain('Gatekeeper')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/shared/release-contract.test.ts`

Expected: FAIL，`electron-builder.yml` 不存在。

- [ ] **Step 3: Write minimal implementation**

`electron-builder.yml` 的 `productName` 是枝序，`executableName` 是 `JSONBranch`，文件关联只有 `json`，`role: Editor`，`rank: Alternate`。权限文件只有 JIT 两个键，没有摄像头、麦克风、Apple Events 或 `disable-library-validation`。工作流先打 `apps/extension/dist` 的 zip，再在 `macos-14` 上按架构打包。签名步骤调用 `signingEnabled`。为假时日志写「未签名，其他 Mac 上通常会被 Gatekeeper 拦截，接收者需要明确同意才能打开」。README 写：`pnpm install` 后 `pnpm run build:extension`，在 `chrome://extensions` 打开开发者模式，选择「加载未打包的扩展程序」，目录是 `apps/extension/dist`。写明没有网上应用店的一键安装。macOS 安装写 `pnpm run package:mac`，并写未签名包的 Gatekeeper 说明。写明扩展和 macOS 应用都不包含统计地址。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/shared/release-contract.test.ts`

Expected: PASS。这个测试不运行 electron-builder，也不宣称 dmg 已生成。

- [ ] **Step 5: Commit**

```bash
git add electron-builder.yml entitlements.mac.plist .github/workflows/release.yml README.md src/shared/release-contract.test.ts
git commit -m "feat: package the extension zip and both macOS architectures"
```

## 验收对照

| 设计验收 | 任务 |
| --- | --- |
| 1 点击图标打开全页，无弹窗，不改网页 | Task 7、Task 8 |
| 2 格式化、搜索、复制路径和值、删除后撤销 | Task 3、Task 4、Task 5 |
| 3 只有 storage 权限 | Task 7 |
| 4 CSP 与本地脚本 | Task 7、Task 8 |
| 5 Monaco 或 textarea | Task 6、Task 8 |
| 6 macOS 打开保存和关闭三按钮 | Task 9 |
| 7 双架构 dmg，未签名可产出，签名身份不是 Orca | Task 10 |
| 8 未打包扩展 zip，无商店提交 | Task 10 |
| 9 LICENSE 与 NOTICE | Task 1 |
| 10 无统计端点 | Task 7 的网络断言、Task 9 的请求拦截、Task 10 的 README |

`chrome-smoke` 在 macOS 的 Chrome 里人工确认验收 1 到 5。`smoke` 对 arm64 包做验收 6，对 x64 包做启动、打开、保存、另存为。这些作业未跑之前，发布说明保持「尚未人工验收」。
