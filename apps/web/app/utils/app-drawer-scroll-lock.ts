interface ScrollLockSnapshot {
  scrollX: number
  scrollY: number
  bodyOverflow: string
  rootOverflow: string
  appPosition: string
  appTop: string
  appLeft: string
  appWidth: string
  appOverflow: string
  appOverscrollBehavior: string
}

const owners = new Set<symbol>()
let snapshot: ScrollLockSnapshot | undefined
let appRoot: HTMLElement | null = null

const freezeApp = () => {
  appRoot = document.getElementById('__nuxt')
  if (!appRoot) return
  snapshot = {
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    bodyOverflow: document.body.style.overflow,
    rootOverflow: document.documentElement.style.overflow,
    appPosition: appRoot.style.position,
    appTop: appRoot.style.top,
    appLeft: appRoot.style.left,
    appWidth: appRoot.style.width,
    appOverflow: appRoot.style.overflow,
    appOverscrollBehavior: appRoot.style.overscrollBehavior
  }
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
  appRoot.style.position = 'fixed'
  appRoot.style.top = `-${snapshot.scrollY}px`
  appRoot.style.left = '0'
  appRoot.style.width = '100%'
  appRoot.style.overflow = 'hidden'
  appRoot.style.overscrollBehavior = 'none'
}

const restoreApp = () => {
  if (!snapshot) return
  document.body.style.overflow = snapshot.bodyOverflow
  document.documentElement.style.overflow = snapshot.rootOverflow
  if (appRoot) {
    appRoot.style.position = snapshot.appPosition
    appRoot.style.top = snapshot.appTop
    appRoot.style.left = snapshot.appLeft
    appRoot.style.width = snapshot.appWidth
    appRoot.style.overflow = snapshot.appOverflow
    appRoot.style.overscrollBehavior = snapshot.appOverscrollBehavior
  }
  const { scrollX, scrollY } = snapshot
  snapshot = undefined
  appRoot = null
  window.scrollTo(scrollX, scrollY)
}

export const createAppDrawerScrollLock = () => {
  const owner = Symbol('app-drawer-scroll-lock')
  return {
    lock: () => {
      if (owners.has(owner)) return
      if (!owners.size) freezeApp()
      owners.add(owner)
    },
    unlock: () => {
      if (!owners.delete(owner) || owners.size) return
      restoreApp()
    }
  }
}
