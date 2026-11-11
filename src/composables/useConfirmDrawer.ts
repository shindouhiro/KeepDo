import { inject, onScopeDispose, provide, shallowRef } from 'vue'
import type { InjectionKey } from 'vue'
import type { ConfirmationOptions } from '../lib/confirmation-queue'
import { createConfirmationQueue } from '../lib/confirmation-queue'

const confirmationKey: InjectionKey<ReturnType<typeof createConfirmationQueue>> = Symbol('confirmation-drawer')

export function provideConfirmDrawer() {
  const pending = shallowRef<ConfirmationOptions | null>(null)
  const queue = createConfirmationQueue(options => { pending.value = options })
  provide(confirmationKey, queue)
  onScopeDispose(queue.dispose)
  return { pending, settle: queue.settle }
}

export function useConfirmDrawer() {
  const queue = inject(confirmationKey)
  if (!queue) throw new Error('确认抽屉尚未初始化')
  const owner = Symbol('confirmation-owner')
  onScopeDispose(() => queue.cancelOwner(owner))
  return (options: ConfirmationOptions) => queue.ask(owner, options)
}
