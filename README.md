# 枝序 JSONBranch

枝序把 JSON 格式化成可搜索的树。第一版只处理你粘贴或打开的文本，不读取正在浏览的网页，没有 content script，也不上报统计。

Chrome 扩展和 macOS 应用共用 `packages/json-core` 与 `packages/json-view`。界面在系统语言以 `en` 开头时用英文，其余语言用中文。

## 开发

```bash
pnpm install
pnpm test
pnpm run typecheck
pnpm run build:extension
```

## 安装 Chrome 扩展

构建完成后，扩展在 `apps/extension/dist`，清单在这个目录的根上。

1. 打开 `chrome://extensions`。
2. 打开开发者模式。
3. 选择「加载未打包的扩展程序」。
4. 选中 `apps/extension/dist`。

没有 Chrome 网上应用店的一键安装。点击工具栏图标会打开完整标签页，不会弹出作为主界面的小窗，也不会改写当前网页。扩展权限只有 `storage`，用来记住这一份粘贴文本。

本仓库的自动化测试在 Chrome for Testing 里加载这个未打包目录。Google Chrome 157 会忽略命令行里的 `--load-extension`，开发者模式里的「加载未打包的扩展程序」仍然可用。

## macOS

```bash
pnpm run build:macos
pnpm run package:mac
```

`package:mac` 需要在 macOS 上运行。发布工作流使用仍受支持的 `macos-15`（`macos-14` 已于 2026-11-02 退役），按 `arm64` 和 `x64` 分别产出：

- `JSONBranch-macos-arm64.dmg` 与 `.zip`
- `JSONBranch-macos-x64.dmg` 与 `.zip`

bundle id 是 `app.jsonbranch.macos`。应用可以打开和存储本地 `.json`，关闭未存储的文档前会询问「存储」「不存储」「取消」。文件关联的角色是 Editor，等级是 Alternate，不替换系统里已有的默认程序。

签名和公证只在 `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`、`CSC_LINK`、`CSC_KEY_PASSWORD` 五项都有值时进行。缺任何一项就上传未签名包，构建不会因此失败。未签名应用在其他 Mac 上通常会被 Gatekeeper 拦截，接收者需要在系统设置或 Finder 的「打开」里明确同意后才能运行。没有公证的包不是双击即开的正式安装包。Linux 不能为这些包签名或公证。

人工验收作业 `smoke` 和 `chrome-smoke` 只在手动触发工作流时出现。`release.yml` 目前不在默认分支上，因此 GitHub 不能从功能分支接受 `workflow_dispatch`。打包由推送到 `cursor/jsonbranch-first-release-550b` 触发。点击扩展图标是否打开全页，在无头 Chrome 里没有可点击的工具栏按钮，这一步仍是人工验收。

## 许可

根目录 `LICENSE` 是上游 Orca 的 MIT 声明，版权人是 Lovecast Inc.。`NOTICE` 写明格式化器派生自 https://github.com/stablyai/orca 和 https://github.com/yongwuzhijin/orca 。枝序新写的扩展壳和 macOS 壳同样使用这份 MIT 条款，版权人是仓库所有者。
