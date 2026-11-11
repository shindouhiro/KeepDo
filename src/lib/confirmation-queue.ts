export type ConfirmationOptions = {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export function createConfirmationQueue(notify: (options: ConfirmationOptions | null) => void) {
  const queue: Array<{ owner: symbol; options: ConfirmationOptions; resolve: (accepted: boolean) => void }> = []
  function publish() { notify(queue[0]?.options ?? null) }
  function ask(owner: symbol, options: ConfirmationOptions) {
    return new Promise<boolean>(resolve => {
      queue.push({ owner, options, resolve })
      publish()
    })
  }
  function settle(accepted: boolean) {
    const request = queue.shift()
    publish()
    request?.resolve(accepted)
  }
  function cancelOwner(owner: symbol) {
    for (let index = queue.length - 1; index >= 0; index--) {
      if (queue[index]?.owner === owner) queue.splice(index, 1)[0]?.resolve(false)
    }
    publish()
  }
  function dispose() {
    for (const request of queue.splice(0)) request.resolve(false)
    publish()
  }
  return { ask, settle, cancelOwner, dispose }
}
