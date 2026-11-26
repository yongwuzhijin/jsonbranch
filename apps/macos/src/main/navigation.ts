export function windowSecurityOptions(): {
  contextIsolation: true
  nodeIntegration: false
  sandbox: true
  webSecurity: true
} {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true
  }
}

export function shouldBlockRequest(url: string): boolean {
  return !url.startsWith('app://')
}
