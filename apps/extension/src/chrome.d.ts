declare const chrome: {
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>
      set(items: Record<string, unknown>): Promise<void>
    }
    session: {
      get(key: string): Promise<Record<string, unknown>>
      set(items: Record<string, unknown>): Promise<void>
    }
  }
  tabs: {
    create(options: { url: string }): Promise<{ id?: number }>
    update(id: number, options: { active: boolean }): Promise<unknown>
  }
  runtime: {
    getURL(path: string): string
  }
  action: {
    onClicked: {
      addListener(callback: () => void): void
    }
  }
}
