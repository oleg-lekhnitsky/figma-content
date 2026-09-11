import type { Ref } from 'vue'

const keyboardInput = 'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]), textarea, [contenteditable="true"]'

export const useDrawerViewport = (root: Ref<HTMLElement | null>, open: () => boolean) => {
  const viewportStyle = ref<Record<string, string>>({})
  let layoutHeight = 0
  let layoutWidth = 0
  let keyboardOpen = false
  let frame = 0

  const update = async () => {
    frame = 0
    if (!open()) return
    if (!root.value?.querySelector('.asset-filter-controls') || !window.matchMedia('(max-width: 520px)').matches) {
      viewportStyle.value = {}
      layoutHeight = 0
      return
    }
    const viewport = window.visualViewport
    // Pinch zoom remains under browser control.
    if (viewport && Math.abs(viewport.scale - 1) > .05) return
    const active = document.activeElement
    const editing = active instanceof HTMLElement && root.value.contains(active) && active.matches(keyboardInput)
    const widthChanged = layoutWidth !== window.innerWidth
    if (!layoutHeight || widthChanged) {
      layoutHeight = window.innerHeight
      layoutWidth = window.innerWidth
      keyboardOpen = false
    }
    const visibleHeight = viewport?.height ?? window.innerHeight
    const visibleTop = viewport?.offsetTop ?? 0
    keyboardOpen = (editing || keyboardOpen) && layoutHeight - visibleHeight > 80
    if (!keyboardOpen && !editing) layoutHeight = window.innerHeight
    const inset = keyboardOpen ? Math.max(0, layoutHeight - visibleHeight - visibleTop) : 0
    viewportStyle.value = {
      '--drawer-layout-height': `${layoutHeight}px`,
      '--drawer-keyboard-inset': `${inset}px`,
      '--drawer-visible-height': `${keyboardOpen ? visibleHeight : layoutHeight}px`
    }
    if (!keyboardOpen || !(active instanceof HTMLElement)) return
    await nextTick()
    if (!open() || document.activeElement !== active) return
    // Scroll only the sheet's contents; scrolling the document moves the backdrop
    // and fights the drawer's background scroll lock.
    const scroll = active.closest<HTMLElement>('.filter-sheet-content, .video-panel-scroll')
    if (!scroll) return
    const field = active.getBoundingClientRect()
    const bounds = scroll.getBoundingClientRect()
    const top = Math.max(bounds.top, visibleTop) + 12
    const bottom = Math.min(bounds.bottom, visibleTop + visibleHeight) - 12
    if (field.bottom > bottom) scroll.scrollTop += field.bottom - bottom
    else if (field.top < top) scroll.scrollTop -= top - field.top
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update)
  }
  watch(open, value => {
    if (value) {
      layoutHeight = window.innerHeight
      layoutWidth = window.innerWidth
      keyboardOpen = false
      schedule()
    }
  })
  onMounted(() => {
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule)
    document.addEventListener('focusin', schedule)
    document.addEventListener('focusout', schedule)
    schedule()
  })
  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    window.visualViewport?.removeEventListener('resize', schedule)
    window.visualViewport?.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    document.removeEventListener('focusin', schedule)
    document.removeEventListener('focusout', schedule)
  })
  return viewportStyle
}
