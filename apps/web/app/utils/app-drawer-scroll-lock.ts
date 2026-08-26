interface ScrollLockSnapshot {
  bodyOverflow: string
  rootOverflow: string
  bodyOverscrollBehavior: string
  rootOverscrollBehavior: string
}

const owners = new Set<symbol>()
let snapshot: ScrollLockSnapshot | undefined
let appRoot: HTMLElement | null = null

const blockBackgroundTouch = (event: TouchEvent) => {
  if (event.cancelable && event.target instanceof Node && appRoot?.contains(event.target)) event.preventDefault()
}

const freezeApp = () => {
  appRoot = document.getElementById('__nuxt')
  if (!appRoot) return
  snapshot = {
    bodyOverflow: document.body.style.overflow,
    rootOverflow: document.documentElement.style.overflow,
    bodyOverscrollBehavior: document.body.style.overscrollBehavior,
    rootOverscrollBehavior: document.documentElement.style.overscrollBehavior
  }
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overscrollBehavior = 'none'
  document.documentElement.style.overscrollBehavior = 'none'
  document.addEventListener('touchmove', blockBackgroundTouch, { capture: true, passive: false })
}

const restoreApp = () => {
  if (!snapshot) return
  document.removeEventListener('touchmove', blockBackgroundTouch, { capture: true })
  document.body.style.overflow = snapshot.bodyOverflow
  document.documentElement.style.overflow = snapshot.rootOverflow
  document.body.style.overscrollBehavior = snapshot.bodyOverscrollBehavior
  document.documentElement.style.overscrollBehavior = snapshot.rootOverscrollBehavior
  snapshot = undefined
  appRoot = null
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
