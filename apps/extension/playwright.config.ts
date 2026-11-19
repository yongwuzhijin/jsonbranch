import { defineConfig } from '@playwright/test'

const dist = 'apps/extension/dist'

export default defineConfig({
  testMatch: 'apps/extension/viewer.e2e.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    // Google Chrome 157 ignores --load-extension. Playwright's Chromium is Chrome for Testing,
    // which still accepts the unpacked directory. The same flags are what a user-facing Chrome
    // build that allows the switch would use.
    headless: true,
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`]
    }
  }
})
