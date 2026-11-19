import path from 'node:path'

export function resolveRendererFile(rendererRoot: string, pathname: string): string | null {
  const root = path.resolve(rendererRoot)
  const relative = decodeURIComponent(pathname).replace(/^[/\\]+/, '')
  const file = path.resolve(root, relative === '' ? 'index.html' : relative)
  if (file !== root && !file.startsWith(root + path.sep)) {
    return null
  }
  return file
}
