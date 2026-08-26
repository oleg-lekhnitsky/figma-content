interface ScrollLockSnapshot {
  bodyOverflow: string
  rootOverflow: string
  bodyOverscrollBehavior: string
  rootOverscrollBehavior: string
  appTouchAction: string
}

const owners = new Set<symbol>()
let snapshot: ScrollLockSnapshot | undefined
let appRoot: HTMLElement | null = null
let touchId: number | undefined
let lastTouchY = 0

const findTouch = (touches: TouchList) => Array.from(touches).find(touch => touch.identifier === touchId)

const startTouch = (event: TouchEvent) => {
  if (event.touches.length !== 1) {
    touchId = undefined
    return
  }
  const touch = event.touches[0]
  if (!touch) return
  touchId = touch.identifier
  lastTouchY = touch.clientY
}

const blockBackgroundTouch = (event: TouchEvent) => {
  if (event.touches.length !== 1 || !(event.target instanceof Element)) return
  const touch = findTouch(event.touches)
  if (!touch) return
  const deltaY = touch.clientY - lastTouchY
  lastTouchY = touch.clientY
  const scrollContainer = event.target.closest<HTMLElement>('.filter-sheet-content, .video-panel-scroll, [data-drawer-scroll], .selection-panel--filter-overlay')
  if (scrollContainer && Math.abs(deltaY) > 0) {
    const canScrollTowardTop = deltaY > 0 && scrollContainer.scrollTop > 0
    const canScrollTowardBottom = deltaY < 0 && scrollContainer.scrollTop + scrollContainer.clientHeight < scrollContainer.scrollHeight - 1
    if (canScrollTowardTop || canScrollTowardBottom) return
  }
  if (event.cancelable) event.preventDefault()
}

const freezeApp = () => {
  appRoot = document.getElementById('__nuxt')
  if (!appRoot) return
  snapshot = {
    bodyOverflow: document.body.style.overflow,
    rootOverflow: document.documentElement.style.overflow,
    bodyOverscrollBehavior: document.body.style.overscrollBehavior,
    rootOverscrollBehavior: document.documentElement.style.overscrollBehavior,
    appTouchAction: appRoot.style.touchAction
  }
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overscrollBehavior = 'none'
  document.documentElement.style.overscrollBehavior = 'none'
  appRoot.style.touchAction = 'none'
  document.addEventListener('touchstart', startTouch, { capture: true, passive: true })
  document.addEventListener('touchmove', blockBackgroundTouch, { capture: true, passive: false })
}

const restoreApp = () => {
  if (!snapshot) return
  document.removeEventListener('touchstart', startTouch, { capture: true })
  document.removeEventListener('touchmove', blockBackgroundTouch, { capture: true })
  document.body.style.overflow = snapshot.bodyOverflow
  document.documentElement.style.overflow = snapshot.rootOverflow
  document.body.style.overscrollBehavior = snapshot.bodyOverscrollBehavior
  document.documentElement.style.overscrollBehavior = snapshot.rootOverscrollBehavior
  if (appRoot) appRoot.style.touchAction = snapshot.appTouchAction
  touchId = undefined
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
