const CONTROL_SELECTOR = '.filter-option-list--segmented, .video-choice-row'
const CONTROL_CLASS = 'segmented-control-has-pill'
const READY_CLASS = 'segmented-control-pill-ready'

function directButtons(control: HTMLElement) {
  return Array.from(control.children).filter((child): child is HTMLButtonElement => child instanceof HTMLButtonElement)
}

function supportsSlidingPill(control: HTMLElement) {
  const buttons = directButtons(control)
  return buttons.length > 0 && (!control.classList.contains('video-choice-row') || buttons.length < 6)
}

function selectedButton(control: HTMLElement) {
  return directButtons(control).find(button => button.getAttribute('aria-pressed') === 'true')
}

export default defineNuxtPlugin(() => {
  const controls = new Set<HTMLElement>()
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target instanceof HTMLElement) positionPill(entry.target, false)
    }
  })

  function positionPill(control: HTMLElement, animate: boolean) {
    if (!supportsSlidingPill(control)) {
      teardownControl(control)
      return
    }

    const selected = selectedButton(control)
    if (!selected) {
      control.style.setProperty('--segmented-pill-opacity', '0')
      return
    }

    if (!animate) control.classList.remove(READY_CLASS)
    control.style.setProperty('--segmented-pill-opacity', '1')
    control.style.setProperty('--segmented-pill-width', `${selected.offsetWidth}px`)
    control.style.setProperty('--segmented-pill-height', `${selected.offsetHeight}px`)
    control.style.setProperty('--segmented-pill-x', `${selected.offsetLeft}px`)
    control.style.setProperty('--segmented-pill-y', `${selected.offsetTop}px`)

    if (!animate) {
      void control.offsetWidth
      requestAnimationFrame(() => {
        if (control.isConnected) control.classList.add(READY_CLASS)
      })
    } else {
      control.classList.add(READY_CLASS)
    }
  }

  function setupControl(control: HTMLElement) {
    if (!supportsSlidingPill(control)) {
      teardownControl(control)
      return
    }

    if (!controls.has(control)) {
      control.classList.add(CONTROL_CLASS)
      controls.add(control)
      resizeObserver.observe(control)
    }
    positionPill(control, false)
  }

  function teardownControl(control: HTMLElement) {
    if (!controls.has(control)) return
    resizeObserver.unobserve(control)
    controls.delete(control)
    control.classList.remove(CONTROL_CLASS, READY_CLASS)
    control.style.removeProperty('--segmented-pill-opacity')
    control.style.removeProperty('--segmented-pill-width')
    control.style.removeProperty('--segmented-pill-height')
    control.style.removeProperty('--segmented-pill-x')
    control.style.removeProperty('--segmented-pill-y')
  }

  function controlsWithin(node: Node) {
    if (!(node instanceof HTMLElement)) return []
    const matches = node.matches(CONTROL_SELECTOR) ? [node] : []
    return [...matches, ...node.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)]
  }

  document.querySelectorAll<HTMLElement>(CONTROL_SELECTOR).forEach(setupControl)

  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        const button = mutation.target
        if (!(button instanceof HTMLButtonElement)) continue
        const control = button.parentElement?.closest<HTMLElement>(CONTROL_SELECTOR)
        if (control) positionPill(control, true)
        continue
      }

      mutation.addedNodes.forEach(node => controlsWithin(node).forEach(setupControl))
      mutation.removedNodes.forEach(node => controlsWithin(node).forEach(teardownControl))

      if (mutation.target instanceof HTMLElement) {
        const control = mutation.target.closest<HTMLElement>(CONTROL_SELECTOR)
        if (control) setupControl(control)
      }
    }
  })

  mutationObserver.observe(document.body, {
    attributeFilter: ['aria-pressed'],
    attributes: true,
    childList: true,
    subtree: true,
  })

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      mutationObserver.disconnect()
      resizeObserver.disconnect()
      controls.forEach((control) => {
        control.classList.remove(CONTROL_CLASS, READY_CLASS)
        control.style.removeProperty('--segmented-pill-opacity')
        control.style.removeProperty('--segmented-pill-width')
        control.style.removeProperty('--segmented-pill-height')
        control.style.removeProperty('--segmented-pill-x')
        control.style.removeProperty('--segmented-pill-y')
      })
      controls.clear()
    })
  }
})
