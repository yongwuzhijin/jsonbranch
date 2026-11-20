import { chromeSessionArea, VIEWER_TAB_KEY, type SessionArea } from './storage'

export type ChromeTabs = {
  create(url: string): Promise<{ id: number }>
  update(id: number, active: true): Promise<void>
}

function viewerUrl(): string {
  const runtime = (globalThis as { chrome?: typeof chrome }).chrome?.runtime
  if (!runtime?.getURL) {
    return 'viewer.html'
  }
  return runtime.getURL('viewer.html')
}

export async function openViewer(tabs: ChromeTabs, session: SessionArea): Promise<void> {
  const existing = await session.get(VIEWER_TAB_KEY)
  if (typeof existing === 'number') {
    try {
      await tabs.update(existing, true)
      return
    } catch {
      // The remembered tab is gone. Open a new one below.
    }
  }
  const created = await tabs.create(viewerUrl())
  await session.set(VIEWER_TAB_KEY, created.id)
}

export function chromeTabs(): ChromeTabs {
  return {
    async create(url) {
      const tab = await chrome.tabs.create({ url })
      if (tab.id === undefined) {
        throw new Error('Chrome did not return a tab id')
      }
      return { id: tab.id }
    },
    async update(id, active) {
      await chrome.tabs.update(id, { active })
    }
  }
}

const browser = (globalThis as { chrome?: typeof chrome }).chrome
if (browser?.action?.onClicked) {
  browser.action.onClicked.addListener(() => {
    void openViewer(chromeTabs(), chromeSessionArea())
  })
}
