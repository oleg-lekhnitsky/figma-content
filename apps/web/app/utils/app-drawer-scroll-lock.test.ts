import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAppDrawerScrollLock } from './app-drawer-scroll-lock'

afterEach(() => vi.unstubAllGlobals())

describe('drawer background scroll lock', () => {
  it('pins the background without resetting focus scrolling, then restores it after the last drawer closes', () => {
    const bodyStyle = { position: 'relative', top: '', left: '', width: '90%', overflow: 'auto', overscrollBehavior: '' }
    const originalStyle = { ...bodyStyle }
    const app = { style: { touchAction: 'pan-y' } }
    const browser = Object.assign(new EventTarget(), { scrollX: 0, scrollY: 320, scrollTo: vi.fn() })
    const doc = Object.assign(new EventTarget(), {
      body: { style: bodyStyle },
      documentElement: { style: { overflow: '', overscrollBehavior: '' } },
      getElementById: () => app
    })
    vi.stubGlobal('window', browser)
    vi.stubGlobal('document', doc)
    const outer = createAppDrawerScrollLock()
    const inner = createAppDrawerScrollLock()
    try {
      outer.lock()
      expect(bodyStyle.position).toBe('fixed')
      expect(bodyStyle.top).toBe('-320px')
      inner.lock()
      browser.scrollY = 40
      browser.dispatchEvent(new Event('scroll'))
      expect(browser.scrollTo).not.toHaveBeenCalled()
      outer.unlock()
      expect(bodyStyle.position).toBe('fixed')
      expect(browser.scrollTo).not.toHaveBeenCalled()
      inner.unlock()
      expect(bodyStyle).toEqual(originalStyle)
      expect(app.style.touchAction).toBe('pan-y')
      expect(browser.scrollTo).toHaveBeenCalledExactlyOnceWith(0, 320)
      inner.unlock()
      expect(browser.scrollTo).toHaveBeenCalledTimes(1)
    } finally {
      outer.unlock()
      inner.unlock()
    }
  })
})
