import { chromium, expect, test } from '@playwright/test'
import { readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const dist = path.resolve('apps/extension/dist')

function chromeForTesting(): string {
  const root = path.join(homedir(), '.cache/ms-playwright')
  const directory = readdirSync(root)
    .filter((name) => name.startsWith('chromium-') && !name.includes('headless'))
    .sort()
    .at(-1)
  if (!directory) {
    throw new Error('Playwright Chromium is not installed')
  }
  return path.join(root, directory, 'chrome-linux64', 'chrome')
}

test('full tab formats pasted JSON without content scripts', async () => {
  const manifest = JSON.parse(readFileSync(path.join(dist, 'manifest.json'), 'utf8')) as {
    content_scripts?: unknown
    permissions: string[]
    content_security_policy: { extension_pages: string }
  }
  expect(manifest.content_scripts).toBeUndefined()
  expect(manifest.permissions).toEqual(['storage'])
  expect(manifest.host_permissions).toBeUndefined()
  expect(manifest.content_security_policy.extension_pages).toBe(
    "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self'"
  )

  // Branded Chrome 157 ignores --load-extension. Chrome for Testing, which Playwright
  // installs as Chromium, still loads the unpacked directory.
  const context = await chromium.launchPersistentContext('', {
    executablePath: chromeForTesting(),
    headless: true,
    viewport: { width: 1280, height: 800 },
    ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
    args: [
      `--disable-extensions-except=${dist}`,
      `--load-extension=${dist}`,
      '--headless=new',
      '--lang=zh-CN',
      '--accept-lang=zh-CN'
    ]
  })

  const external: string[] = []
  try {
    const ownWorker = async (worker: { evaluate<T>(pageFunction: () => T): Promise<T> }): Promise<boolean> => {
      const name = await worker.evaluate(() => chrome.runtime.getManifest().name).catch(() => '')
      return name === '枝序'
    }
    let background = undefined as Awaited<ReturnType<typeof context.waitForEvent<'serviceworker'>>> | undefined
    const deadline = Date.now() + 15_000
    while (!background && Date.now() < deadline) {
      for (const worker of context.serviceWorkers()) {
        if (await ownWorker(worker)) {
          background = worker
          break
        }
      }
      if (!background) {
        await context.waitForEvent('serviceworker', { timeout: Math.max(500, deadline - Date.now()) }).catch(() => undefined)
      }
    }
    if (!background) {
      throw new Error(`JSONBranch service worker did not start: ${context.serviceWorkers().map((worker) => worker.url()).join(', ')}`)
    }
    expect(background).toBeTruthy()
    expect(background.url()).toContain('chrome-extension://')
    const extensionId = new URL(background.url()).host
    const page = await context.newPage()
    page.on('request', (request) => {
      const url = request.url()
      if (url.startsWith('chrome-extension://') || url.startsWith('data:') || url === 'about:blank') {
        return
      }
      external.push(url)
    })
    await page.goto(`chrome-extension://${extensionId}/viewer.html`)
    expect(page.url()).toContain('chrome-extension://')
    const formatButton = page.getByRole('button', { name: /^(格式化|Format)$/ })
    await expect(formatButton).toBeVisible()
    await expect(formatButton).toHaveAttribute('title', '格式化')
    const chinese = (await formatButton.getAttribute('aria-label')) === '格式化'
    const label = chinese
      ? { format: '格式化', copyPath: '复制路径', delete: '删除', undo: '撤销' }
      : { format: 'Format', copyPath: 'Copy path', delete: 'Delete', undo: 'Undo' }
    await page.locator('.view-lines').click()
    await page.keyboard.press('Control+A')
    await page.keyboard.insertText('{"name":"Beta"}')
    await expect(page.getByTestId('json-tree-row-name')).toBeVisible()
    await page.getByRole('button', { name: label.format }).click()
    await expect
      .poll(async () =>
        background.evaluate(async () => {
          const data = await chrome.storage.local.get('document')
          return (data.document as { input?: string } | undefined)?.input ?? ''
        })
      )
      .toBe('{\n  "name": "Beta"\n}')
    await page.reload()
    await expect(page.locator('.view-lines')).toContainText('"Beta"')
    await page.getByRole('searchbox').fill('beta')
    await expect(page.getByTestId('json-search-count')).toContainText('1')
    await page.getByRole('button', { name: label.copyPath, exact: true }).click()
    await page.screenshot({
      path: '/opt/cursor/artifacts/jsonbranch-extension-formatted.png',
      fullPage: true
    })
    await page.getByTestId('json-tree-row-name').click()
    await page.getByRole('button', { name: label.delete, exact: true }).click()
    await expect(page.locator('.view-lines')).toContainText('{}')
    await expect(page.locator('.view-lines')).not.toContainText('Beta')
    await page.getByRole('button', { name: label.undo, exact: true }).click()
    await expect(page.locator('.view-lines')).toContainText('"Beta"')
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
    expect(external).toEqual([])
  } finally {
    await context.close()
  }
})
