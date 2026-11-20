export function createJsonWorker(): Worker {
  return new Worker(new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url), {
    type: 'module'
  })
}

export function createEditorWorker(): Worker {
  return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url), {
    type: 'module'
  })
}

export function installMonacoWorkers(): void {
  globalThis.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      if (label === 'json') {
        return createJsonWorker()
      }
      return createEditorWorker()
    }
  }
}

export function probeEditorWorker(createWorker?: () => Worker): 'monaco' | 'textarea' {
  const opened: Worker[] = []
  try {
    if (createWorker) {
      opened.push(createWorker())
    } else {
      opened.push(createEditorWorker(), createJsonWorker())
    }
    return 'monaco'
  } catch {
    return 'textarea'
  } finally {
    for (const worker of opened) {
      worker.terminate()
    }
  }
}
