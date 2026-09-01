let lockCount = 0
let appRoot: HTMLElement | null = null
let appRootWasInert = false

export function lockAppDrawerBackground() {
  if (lockCount === 0) {
    appRoot = document.getElementById('__nuxt')
    appRootWasInert = appRoot?.inert ?? false
  }
  lockCount += 1
  if (appRoot) appRoot.inert = true
}

export function unlockAppDrawerBackground() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount > 0) return
  if (appRoot) appRoot.inert = appRootWasInert
  appRoot = null
  appRootWasInert = false
}
