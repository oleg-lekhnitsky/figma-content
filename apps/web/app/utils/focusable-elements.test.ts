import { afterEach, describe, expect, it, vi } from 'vitest'
import { focusableElements } from './focusable-elements'

afterEach(() => vi.unstubAllGlobals())

describe('shared overlay focus navigation', () => {
  it('keeps DOM order while excluding hidden, disabled, inert, and untabbable controls', () => {
    const control = (state: { tabIndex?: number; disabled?: boolean; inert?: boolean; rendered?: boolean; visibility?: string } = {}) => ({
      tabIndex: state.tabIndex ?? 0,
      visibility: state.visibility ?? 'visible',
      matches: () => Boolean(state.disabled),
      closest: () => state.inert ? {} : null,
      getClientRects: () => state.rendered === false ? [] : [{}]
    })
    const first = control(), last = control()
    const candidates = [first, control({ tabIndex: -1 }), control({ disabled: true }), control({ inert: true }), control({ rendered: false }), control({ visibility: 'hidden' }), last]
    vi.stubGlobal('getComputedStyle', (element: { visibility: string }) => ({ visibility: element.visibility }))
    const root = { querySelectorAll: () => candidates } as unknown as ParentNode
    expect(focusableElements(root)).toEqual([first, last])
  })
})
