type PullRefreshHandler = () => Promise<void> | void

const handlers = new Set<PullRefreshHandler>()

export const usePullRefreshHandler = (handler: PullRefreshHandler) => {
  onMounted(() => handlers.add(handler))
  onBeforeUnmount(() => handlers.delete(handler))
}

export const runPullRefresh = async () => {
  const activeHandlers = [...handlers]
  if (!activeHandlers.length) {
    await refreshNuxtData()
    return
  }
  await Promise.all(activeHandlers.map(handler => handler()))
}
