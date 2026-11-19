# 枝序 JSONBranch 设计说明

日期：2026-11-19
状态：待目标仓库评审。本文只描述设计，不包含实现。
目标仓库：https://github.com/yongwuzhijin/jsonbranch （公开）
本文在目标仓库中的路径：`docs/superpowers/specs/2026-11-19-jsonbranch-design.md`
源码边界锁定在 Orca 提交 `73fd1d0329c15ee5b3faf1fa76dea91fd764c281`（https://github.com/yongwuzhijin/orca）。Orca 仓库保持不变，本文不提交到 Orca。

## 1. 已定决定

- 产品名：枝序。英文名：JSONBranch。
- 第一版是手动粘贴。不做网页自动格式化，没有 content script，不读取浏览中的页面。
- Chrome 扩展使用 Manifest V3。点击扩展图标，在完整标签页打开同一套工具。
- 第一版同时提供 macOS Electron 应用。扩展和 macOS 应用使用同一份 JSON 核心和同一份界面。
- 保留格式化、可搜索的树、复制、折叠、删除节点和撤销。
- 完全离线，无统计。扩展不申请主机权限。
- 界面中文优先，并提供英文。系统语言以 `zh` 开头时用中文；以 `en` 开头时用英文；其余语言用中文。
- 直接分发。不上架 Chrome 网上应用店，不提交 Mac App Store，macOS 应用不做沙箱。
- 签名和公证只用 CI 中可选的 Apple 密钥。密钥不全时产出未签名包并写明未签名。不使用 Orca 的团队号 `6CX3WHS9HZ`、bundle id `com.yongwuzhijin.dmonwork` 或产品名 DmonWork。
- macOS 应用的 bundle id 固定为 `app.jsonbranch.macos`。
- 一个 macOS 窗口一份文档。扩展的一份标签页一份粘贴文档。

## 2. 产品范围

枝序把 JSON 文本格式化成可搜索的树，并允许把结果复制出去。Chrome 里的文档来自粘贴或键入。macOS 应用除此之外可以打开和保存本地 `.json` 文件。

第一版包含：

- 左侧文本、右侧虚拟化树。中间可拖动分栏。
- 格式化：合法时用两空格缩进的 `JSON.stringify` 写回左侧。
- 全部展开、全部折叠、行号、保留转义、清空。
- 搜索键和值，在匹配之间上下移动，当前匹配展开祖先。
- 复制格式化结果、复制路径、复制键值对、复制值。
- 删除节点，并用一次撤销放回删除前的左侧文本。
- 解析错误显示行号和列号。空文本有空状态。
- 扩展把最后一次文本保存在本机 `chrome.storage.local`。macOS 应用按文件保存，并有脏标记和关闭提示。

第一版不包含：content script、按网址或响应类型改写页面、弹出小窗作为主界面、主机权限、读取当前标签、远程 JSON 地址、JSON Schema、工作区、SSH、统计、自动更新、Chrome 网上应用店提交、Mac App Store、Windows 和 Linux 安装包。

扩展可以在其他操作系统的 Chrome 中加载，因为包内没有系统专用代码。第一版的人工验收只要求 macOS 上的 Chrome。

## 3. 来源与许可

JSON 行为来自 Orca 分叉中的格式化器，目录 `src/renderer/src/components/json-formatter/`。组装提交 `ade872d146`，行操作、搜索高亮和可撤销删除提交 `528112a42a`，均在锁定的提交内。该目录没有单独许可证。仓库根 `LICENSE` 是 MIT，版权行为 “Copyright (c) 2026 Lovecast Inc.”。上游仓库为 https://github.com/stablyai/orca ，分叉为 https://github.com/yongwuzhijin/orca 。

JSONBranch 的 `LICENSE` 原样保留该 MIT 声明。`NOTICE` 写明格式化器派生自上述分叉，并附上第三方许可证文本。枝序新写的扩展壳和 macOS 壳以仓库所有者为版权人，同样使用 MIT。

沿用并在实现时核对包内许可证的版本：`jsonc-parser` `3.3.1`（MIT）、`monaco-editor` `0.55.1`（MIT）、`@monaco-editor/react` `4.7.0`（MIT）、`@tanstack/react-virtual` `3.14.13`（MIT）、React `19.2.8`（MIT）、Electron `43.7.5`（MIT）、electron-builder `26.15.3`（MIT）。`lucide-react` `0.577.0` 为 ISC。

## 4. 架构

一个仓库四个部分：

- `packages/json-core`：解析、反转义、树行、展开状态、搜索、路径、复制文本、删除节点。只有 TypeScript，不依赖 React、Chrome 和 Electron。
- `packages/json-view`：工具栏、分栏、搜索条、虚拟树和文本槽。文本槽由宿主注入。组件接收数据和回调，不读取全局 store，不调用 `window.api`。
- `apps/extension`：Manifest V3 扩展。
- `apps/macos`：Electron 壳，加载与扩展相同的 `json-view` 构建。

解析规则保持 Orca 的 `parse-json-input.ts`：空白为 `empty`；超过 `5 * 1024 * 1024` 个 UTF-16 码元为 `too-large`；`jsonc-parser` 在 `disallowComments: true`、不允许尾逗号下解析；递归过深捕获为 `too-deep`。`keepEscapes` 为假时先按 `json-unescape.ts` 去掉外层引号并解释转义，再解析。该函数服务「粘贴出来的转义字符串」，不把非法 JSON 悄悄改成合法 JSON。

左侧文本默认是 Monaco。Monaco 使用与 Orca `src/renderer/src/lib/monaco-setup.ts` 相同的本地装载：`loader.config({ monaco })`，worker 来自包内的 `editor.worker` 和 `json.worker`，不从 CDN 下载。两个宿主若在启动 worker 时得到 `EvalError` 或 worker 创建失败，文本槽换成同值的 `<textarea>`，树、格式化、搜索和复制继续可用。这是第一版的固定降级，不是可选项。

## 5. 组件与数据流

`JsonDocument` 是唯一文档模型：

- `input: string`
- `keepEscapes: boolean`
- `showLineNumbers: boolean`
- `baseline: string`，上次载入或成功保存的文本

200 毫秒防抖后把 `input` 交给 `parseJsonInput`。树、搜索和格式化按钮都看这次结果。删除节点在当前值上算出新对象，立刻把格式化文本写进 `input`，并同步更新解析结果，避免防抖期间旧行还留在树上。撤销把 `input` 设回删除前的字符串。

格式化按钮在结果为 `ok` 时把 `JSON.stringify(value, null, 2)` 写进 `input`。清空把 `input` 设为 `''`。这些动作都不自动写磁盘、也不自动上传。

复制由宿主注入：

- 扩展在点击回调里调用 `navigator.clipboard.writeText`。这是使用者手势，不申请 `clipboardWrite`。失败时显示「复制失败」，并选中要复制的文本。
- macOS 渲染进程调用 preload 的 `writeClipboard`。主进程写入系统剪贴板。渲染进程不使用 `navigator.clipboard`，因为沙箱窗口里该 API 不可用。

扩展标签页：

1. 点击工具栏图标。
2. service worker 从 `chrome.storage.session` 读取上次打开的标签 id 并激活 `viewer.html`。id 失效则 `chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') })`，再把新 id 写入 `chrome.storage.session`。这个 id 不是文档内容，浏览器退出后消失。
3. 页面从 `chrome.storage.local` 读出 `input`、`keepEscapes`、`showLineNumbers`。没有记录时这三项是空字符串、`true`、`false`，与 Orca 新开格式化器的初值一致。
4. 文本变化后写入 `chrome.storage.local`。只存这三项。不存标签 URL，不存浏览历史。

macOS 窗口：

1. 打开对话框或「打开方式」读入 `.json` 普通文件。
2. 文本进入 `input`，`baseline` 设为读入字符串。
3. `input !== baseline` 时标题显示脏标记。
4. 存储把 `input` 原样写入该路径，包括尚未格式化的文本。格式化只有在使用者按过按钮、已经改过 `input` 之后才会进文件。
5. 关闭脏窗口时询问「存储 / 不存储 / 取消」。

## 6. Chrome 扩展权限与 CSP

`manifest.json` 固定为：

- `manifest_version: 3`
- `permissions: ["storage"]`
- 不写 `host_permissions`
- 不写 `content_scripts`
- 不写 `sandbox`
- `background.service_worker` 只处理图标点击和标签 id
- `action` 不设 `default_popup`

`storage` 用来在本机记住粘贴内容。`chrome.tabs.create` 和按已知 id 调用 `chrome.tabs.update` 不需要 `tabs` 权限。不查询任意标签的 URL，所以不申请 `tabs`。

CSP 使用 Chrome 允许的扩展页上限，而不是放宽到 `unsafe-eval`：

```json
"content_security_policy": {
  "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self'"
}
```

依据是 Chrome 扩展 CSP 文档：扩展页不能加入 `unsafe-eval`；`wasm-unsafe-eval` 是允许的最宽脚本源之一，默认策略不含它，WebAssembly 因此默认关闭。Monaco `0.55.0` 的发布文件里带有名为 `csp` 的脚本，第一版因此打开 WASM 编译，同时保持脚本、对象和 worker 只能来自扩展包。

Worker 必须是扩展包内的模块文件，用 `new Worker(new URL(..., import.meta.url), { type: 'module' })` 创建。构建禁止 blob worker、字符串 worker 和 CDN。`worker-src` 只有 `'self'`，blob URL 会被浏览器拒绝，这是故意的。

不把编辑器放进 sandbox 页。sandbox 页虽然能使用 `eval`，但和扩展存储隔离，不能作为这个工具的页面。

本次调查没有在 Chrome 里启动 Monaco `0.55.1`。验收第 6 条用真实扩展页确认：在上述 CSP 下，要么 Monaco 和 JSON worker 都启动，要么出现 textarea 降级且格式化、搜索、复制仍然通过。两种结果都算实现符合本文；空白编辑区不算。

## 7. macOS 应用的 IPC

窗口设置：`contextIsolation: true`，`nodeIntegration: false`，`sandbox: true`，`webSecurity: true`。只加载打包后的本地页面。拒绝页面导航到其他来源。会话拒绝出站请求。

preload 只暴露：

- `openDocument()`
- `saveDocument({ path, content, stamp, overwrite })`
- `saveDocumentAs({ content })`
- `writeClipboard(text)`
- `confirmDiscard()`
- `onOpenFromOs(callback)`

授权表按窗口记录使用者点名打开的绝对路径和当时的 `mtimeMs`、`size`。读写都要求真实路径等于表中的路径。另存为成功后把新路径写入表。未授权返回 `denied`。

UTF-8 校验失败、不是普通文件、扩展名不是 `.json`、或大于 20 MiB 时拒绝打开，不写磁盘，不截断。5 MiB 码元以上、20 MiB 以下的文件仍然载入左侧；树显示 `too-large`；存储写回缓冲区全文。这样大文件不会因为无法建树而被截短。

写入使用同目录临时文件，`fsync` 后 `rename`。保存前若 `mtimeMs` 或 `size` 变了，返回 `stale`，界面询问覆盖。取消则不写。

Finder 关联 `.json`，role 为 Editor，rank 为 Alternate，不抢走现有默认程序。

正式签名时，只给 Electron 渲染辅助进程添加 `com.apple.security.cs.allow-jit` 和 `com.apple.security.cs.allow-unsigned-executable-memory`。不复制 Orca 的摄像头、麦克风、定位、蓝牙、Apple Events 或 `disable-library-validation`。不做 App Sandbox。

## 8. 打包与分发

Chrome：构建目录打成 zip，附在 GitHub Release。接收者在 Chrome 的开发者模式中「加载未打包的扩展程序」。不上架时，Chrome 没有一键安装。这是直接分发的限制，第一版接受它，不制作需要商店密钥的 crx 发布流程。

macOS：在 Mac 上分别产出

- `JSONBranch-macos-arm64.dmg` 和 `.zip`
- `JSONBranch-macos-x64.dmg` 和 `.zip`

不做 universal 包。签名和公证只能在 macOS 上做。Linux 不能公证。

五项 `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`、`CSC_LINK`、`CSC_KEY_PASSWORD` 都存在时才 hardened runtime、签名和公证。缺任何一项则上传未签名包，日志写明 Gatekeeper 会拦截其他 Mac 上的未签名应用。缺密钥不使构建失败，配置里没有写死的团队号。

## 9. 错误处理

| 情况 | 行为 |
| --- | --- |
| 空文本 | 树显示空状态，格式化按钮无效 |
| 语法、尾随内容、注释、非法数字或转义 | 树显示行、列和对应中文错误；左侧文本保持原样 |
| 超过 5 MiB 码元 | 树显示过大；左侧保留全文；macOS 保存仍写全文 |
| 嵌套过深 | 树显示过深；不抛到界面外 |
| 复制失败 | 显示失败；扩展中同时选中该段文本 |
| Monaco worker 违反 CSP | 换成 textarea，其余按钮仍作用在同一 `input` |
| 打开的文件非 UTF-8、非普通文件或超过 20 MiB | macOS 显示错误，不写 |
| 磁盘文件已变化 | 保存前询问覆盖 |
| 写入失败 | 保持脏标记和原文件 |
| 未授权路径 | `denied` |

树和格式化都使用同一次 `parseJsonInput` 的对象。`jsonc-parser` `3.3.1` 对 `{"a":1,"a":2}` 的解析结果是 `{"a":2}`，且不产生解析错误。第一版沿用这个结果：重复键只保留后出现的值，界面不再做第二次合并。单元测试锁定这个输入和输出。

## 10. 测试与验收

`packages/json-core` 搬用现有测试的行为：

- 路径对标识符用点号，对特殊键用括号。
- 搜索命中键和值，大小写规则与现有 `json-search.ts` 一致。
- 删除只去掉选中节点，撤销文本与删除前一致。
- `keepEscapes` 为假时，外层引号加转义的对象能被解析；非法转义报 `invalid-escape`。
- 注释被拒绝。
- 超过 5 MiB 码元返回 `too-large` 且不抛异常。
- 过深的括号返回 `too-deep` 且不抛异常。

扩展测试用 Playwright 启动 Chrome，加载未打包目录：

- 默认 CSP 下页面来自 `chrome-extension://`。
- 没有 content script 注册项。
- 粘贴一个对象后能格式化、搜索、复制路径。
- 重新打开标签后文本还在；清空后存储为空字符串。
- 网络面板没有文档请求以外的请求。扩展不发起请求。

macOS 测试用临时目录：

- 打开、修改、保存、另存为、脏标记、关闭取消、关闭不存储、外部修改后的覆盖询问。
- 非法 JSON 可以打开和原样保存。
- 未授权路径不能读。

验收标准：

1. Chrome 中点击图标打开完整标签，不出现作为主界面的弹窗，也不修改正在浏览的网页。
2. 粘贴 JSON 后可以格式化、按树搜索、复制路径、复制值和删除后撤销。
3. 扩展清单只有 `storage` 权限，没有主机权限和 content script。
4. 扩展页 CSP 与第 6 节一致，脚本不来自网络。
5. Monaco 可用，或 textarea 降级可用；两种情况下第 2 条都成立。
6. macOS 应用打开本地 `.json`，保存写回的是左侧文本，关闭脏文档前有存储、不存储、取消。
7. arm64 与 x64 各有一个 dmg。未配置 Apple 密钥时它们未签名；配置齐全时签名身份不是 `6CX3WHS9HZ`。
8. 扩展 zip 可以用「加载未打包的扩展程序」安装。Release 不包含商店提交步骤。
9. `LICENSE` 与 `NOTICE` 保留 Lovecast 的 MIT 声明和 Orca 仓库地址。
10. 应用和扩展都不包含统计端点。

## 11. 实现时的检查

Chrome 与 macOS 禁止各写一份树或解析器。`json-view` 的文本槽是注入的，宿主差异只留在剪贴板、存储和文件对话框。

不增加自动格式化网页。若实现时觉得「顺便识别 JSON 页面」更方便，那仍超出第一版，不要加 content script。

验收第 1 条到第 6 条未通过则第一版不算完成。
