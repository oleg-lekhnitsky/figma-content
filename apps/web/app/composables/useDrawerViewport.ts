import type { Ref } from 'vue'

const keyboardInput = 'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]), textarea, [contenteditable="true"]'

export const useDrawerViewport = (root: Ref<HTMLElement | null>, open: () => boolean) => {
  const viewportStyle = ref<Record<string, string>>({})
  let layoutHeight = 0
  let layoutWidth = 0
  let keyboardOpen = false
  let sheetTop = 0
  let sheetHeight = 0
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
    const sheet = root.value.querySelector<HTMLElement>('.asset-filter-controls')!
    if (!keyboardOpen) {
      // offsetTop excludes the entrance animation's visual translation.
      sheetTop = sheet.offsetTop - visibleTop
      sheetHeight = sheet.offsetHeight
    }
    // Follow the keyboard from its first frame through dismissal. A detection
    // threshold makes the sheet jump once the viewport crosses that threshold.
    keyboardOpen = (editing || keyboardOpen) && layoutHeight - visibleHeight > 0
    if (!keyboardOpen && !editing) layoutHeight = window.innerHeight
    // Keep the top edge stationary. Only low, short sheets need to move enough
    // to leave a usable editing area; never lift the whole sheet by keyboard height.
    // Store geometry in visual-viewport coordinates. Safari pans offsetTop when
    // focus changes; that is a coordinate shift, not extra space for the sheet.
    const editingTop = Math.max(0, Math.min(sheetTop, visibleHeight - Math.min(sheetHeight, 160)))
    viewportStyle.value = {
      '--drawer-layout-height': `${layoutHeight}px`,
      ...(keyboardOpen ? {
        '--drawer-sheet-position': 'absolute',
        '--drawer-sheet-top': `${visibleTop + editingTop}px`,
        '--drawer-sheet-height': `${Math.max(0, Math.min(sheetHeight, visibleHeight - editingTop))}px`
      } : {})
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
      sheetHeight = 0
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
