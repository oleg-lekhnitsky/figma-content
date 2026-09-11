interface ScrollLockSnapshot {
  scrollX: number
  scrollY: number
  bodyOverflow: string
  rootOverflow: string
  bodyOverscrollBehavior: string
  rootOverscrollBehavior: string
  appTouchAction: string
  bodyPosition: string
  bodyTop: string
  bodyLeft: string
  bodyWidth: string
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
  const touch = findTouch(event.touches) ?? event.touches[0]
  if (!touch) return
  if (touchId === undefined) {
    touchId = touch.identifier
    lastTouchY = touch.clientY
    if (event.cancelable) event.preventDefault()
    return
  }
  const deltaY = touch.clientY - lastTouchY
  lastTouchY = touch.clientY
  const scrollContainer = event.target.closest<HTMLElement>('.filter-sheet-content, .video-panel-scroll, [data-drawer-scroll]')
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
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    bodyOverflow: document.body.style.overflow,
    rootOverflow: document.documentElement.style.overflow,
    bodyOverscrollBehavior: document.body.style.overscrollBehavior,
    rootOverscrollBehavior: document.documentElement.style.overscrollBehavior,
    appTouchAction: appRoot.style.touchAction,
    bodyPosition: document.body.style.position,
    bodyTop: document.body.style.top,
    bodyLeft: document.body.style.left,
    bodyWidth: document.body.style.width
  }
  // Hold the background in place without fighting iOS focus scrolling on every
  // scroll event. Restore the original document position once the last drawer closes.
  document.body.style.position = 'fixed'
  document.body.style.top = `${-snapshot.scrollY}px`
  document.body.style.left = `${-snapshot.scrollX}px`
  document.body.style.width = '100%'
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
  document.body.style.position = snapshot.bodyPosition
  document.body.style.top = snapshot.bodyTop
  document.body.style.left = snapshot.bodyLeft
  document.body.style.width = snapshot.bodyWidth
  if (appRoot) appRoot.style.touchAction = snapshot.appTouchAction
  window.scrollTo(snapshot.scrollX, snapshot.scrollY)
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
