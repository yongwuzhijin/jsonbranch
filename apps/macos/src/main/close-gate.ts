export function createCloseGate(): { shouldPrevent(dirty: boolean): boolean; arm(): void } {
  let armed = false
  return {
    shouldPrevent(dirty: boolean): boolean {
      if (armed) {
        armed = false
        return false
      }
      return dirty
    },
    arm(): void {
      armed = true
    }
  }
}

export function choiceEffect(choice: 'save' | 'discard' | 'cancel'): 'stay' | 'arm-and-close' | 'request-save' {
  if (choice === 'discard') {
    return 'arm-and-close'
  }
  if (choice === 'save') {
    return 'request-save'
  }
  return 'stay'
}
