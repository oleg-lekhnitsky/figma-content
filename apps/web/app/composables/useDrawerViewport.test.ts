import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, watch } from 'vue'
import { useDrawerViewport } from './useDrawerViewport'

const setup = async (sheetTop = 80, sheetHeight = 720) => {
  const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 })
  const browser = Object.assign(new EventTarget(), {
    innerHeight: 800, innerWidth: 390, visualViewport: viewport,
    matchMedia: () => ({ matches: browser.innerWidth <= 520 })
  })
  const scroll = { scrollTop: 0, getBoundingClientRect: () => ({ top: 80, bottom: viewport.height }) }
  class Field {
    matches() { return true }
    closest() { return scroll }
    getBoundingClientRect() { return { top: 380, bottom: 424 } }
  }
  const field = new Field()
  const doc = Object.assign(new EventTarget(), { activeElement: null as Field | null })
  const root = { querySelector: () => ({ offsetTop: sheetTop, offsetHeight: sheetHeight }), contains: (element: unknown) => element === field }
  const cleanups: Array<() => void> = []
  let scheduled: FrameRequestCallback | undefined
  vi.stubGlobal('window', browser)
  vi.stubGlobal('document', doc)
  vi.stubGlobal('HTMLElement', Field)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('nextTick', nextTick)
  vi.stubGlobal('onMounted', (callback: () => void) => callback())
  vi.stubGlobal('onBeforeUnmount', (callback: () => void) => cleanups.push(callback))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { scheduled = callback; return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => { scheduled = undefined })
  const scope = effectScope()
  const style = scope.run(() => useDrawerViewport(ref(root as unknown as HTMLElement), () => true))!
  const flush = async () => {
    const callback = scheduled
    scheduled = undefined
    callback?.(0)
    await nextTick()
  }
  await flush()
  return { viewport, browser, doc, field, style, flush, scroll, root, dispose: () => { cleanups.forEach(fn => fn()); scope.stop() } }
}

afterEach(() => vi.unstubAllGlobals())

describe('bottom sheet keyboard viewport', () => {
  it('moves a short sheet only enough to retain usable editing space', async () => {
    const state = await setup(600, 200)
    state.doc.activeElement = state.field
    state.viewport.height = 450
    state.viewport.dispatchEvent(new Event('resize'))
    await state.flush()
    expect(state.style.value['--drawer-sheet-top']).toBe('290px')
    expect(state.style.value['--drawer-sheet-height']).toBe('160px')
    state.dispose()
  })
  it('keeps the top edge fixed while the keyboard reduces the scrollable area', async () => {
    const state = await setup()
    state.doc.activeElement = state.field
    state.viewport.height = 450
    state.viewport.dispatchEvent(new Event('resize'))
    await state.flush()
    expect(state.style.value).toEqual({
      '--drawer-layout-height': '800px', '--drawer-sheet-position': 'absolute', '--drawer-sheet-top': '80px', '--drawer-sheet-height': '370px'
    })
    // Safari may pan its visual viewport while revealing the focused field.
    state.viewport.offsetTop = 40
    state.viewport.dispatchEvent(new Event('scroll'))
    await state.flush()
    expect(state.style.value['--drawer-sheet-top']).toBe('80px')
    expect(state.style.value['--drawer-sheet-height']).toBe('410px')
    state.dispose()
  })

  it('keeps the baseline through gradual resizing and scrolls an obscured input inside the sheet', async () => {
    const state = await setup()
    state.doc.activeElement = state.field
    for (const height of [799, 760, 720, 650, 400]) {
      state.browser.innerHeight = height
      state.viewport.height = height
      state.viewport.dispatchEvent(new Event('resize'))
      await state.flush()
      expect(state.style.value['--drawer-sheet-top']).toBe('80px')
      expect(state.style.value['--drawer-sheet-height']).toBe(`${height - 80}px`)
    }
    expect(state.style.value['--drawer-layout-height']).toBe('800px')
    expect(state.style.value['--drawer-sheet-top']).toBe('80px')
    expect(state.scroll.scrollTop).toBe(36)
    state.dispose()
  })

  it('waits for keyboard dismissal after blur before restoring the sheet', async () => {
    const state = await setup()
    state.doc.activeElement = state.field
    state.viewport.height = 450
    state.viewport.dispatchEvent(new Event('resize'))
    await state.flush()
    state.doc.activeElement = null
    state.doc.dispatchEvent(new Event('focusout'))
    await state.flush()
    expect(state.style.value['--drawer-sheet-height']).toBe('370px')
    state.viewport.height = 760
    state.viewport.dispatchEvent(new Event('resize'))
    await state.flush()
    expect(state.style.value['--drawer-sheet-top']).toBe('80px')
    expect(state.style.value['--drawer-sheet-height']).toBe('680px')
    state.viewport.height = 800
    state.viewport.dispatchEvent(new Event('resize'))
    await state.flush()
    expect(state.style.value['--drawer-sheet-position']).toBeUndefined()
    state.dispose()
  })

  it('leaves pinch zoom alone and releases mobile sizing on rotation to desktop width', async () => {
    const state = await setup()
    state.doc.activeElement = state.field
    state.viewport.scale = 2
    state.viewport.height = 400
    state.viewport.dispatchEvent(new Event('resize'))
    await state.flush()
    expect(state.style.value['--drawer-sheet-position']).toBeUndefined()
    state.browser.innerWidth = 844
    state.browser.dispatchEvent(new Event('resize'))
    await state.flush()
    expect(state.style.value).toEqual({})
    state.dispose()
  })
})
