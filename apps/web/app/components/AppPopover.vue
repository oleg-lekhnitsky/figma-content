<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { focusableElements } from '~/utils/focusable-elements'

const props = withDefaults(defineProps<{
  open?: boolean
  width?: number | 'content'
  offset?: number
  gutter?: number
  align?: 'start' | 'end'
  haspopup?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'
  teleportTo?: string | HTMLElement
  panelClass?: string
}>(), {
  open: false,
  width: 'content',
  offset: undefined,
  gutter: undefined,
  align: 'start',
  haspopup: true,
  teleportTo: 'body',
  panelClass: ''
})

const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const anchor = ref<HTMLElement>()
const panel = ref<HTMLElement>()
const spaceMeasure = ref<HTMLElement>()
const contentId = useId()
const panelStyle = ref<CSSProperties>({ visibility: 'hidden' })
let resizeObserver: ResizeObserver | undefined
let requestedFocus: 'first' | 'last' | undefined

const trigger = () => anchor.value?.querySelector<HTMLElement>('[data-popover-trigger]')

const position = () => {
  const triggerElement = trigger()
  if (!props.open || !triggerElement) return

  const space = spaceMeasure.value?.getBoundingClientRect().width || 12
  const gutter = props.gutter ?? space
  const offset = props.offset ?? space / 3
  const triggerRect = triggerElement.getBoundingClientRect()
  const viewport = window.visualViewport
  const viewportLeft = viewport?.offsetLeft ?? 0
  const viewportTop = viewport?.offsetTop ?? 0
  const viewportRight = viewportLeft + (viewport?.width ?? window.innerWidth)
  const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight)
  const availableWidth = Math.max(0, viewportRight - viewportLeft - gutter * 2)
  const panelWidth = typeof props.width === 'number'
    ? Math.min(props.width, availableWidth)
    : Math.min(Math.max(panel.value?.scrollWidth ?? 0, triggerRect.width), availableWidth)
  const measuredHeight = panel.value?.scrollHeight ?? 0
  const spaceBelow = Math.max(0, viewportBottom - triggerRect.bottom - offset - gutter)
  const spaceAbove = Math.max(0, triggerRect.top - viewportTop - offset - gutter)
  const placeAbove = measuredHeight > spaceBelow && spaceAbove > spaceBelow
  const desiredLeft = props.align === 'end' ? triggerRect.right - panelWidth : triggerRect.left
  const left = Math.max(viewportLeft + gutter, Math.min(desiredLeft, viewportRight - panelWidth - gutter))
  const top = placeAbove
    ? Math.max(viewportTop + gutter, triggerRect.top - offset - Math.min(measuredHeight, spaceAbove))
    : triggerRect.bottom + offset

  panelStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${panelWidth}px`,
    maxHeight: `${placeAbove ? spaceAbove : spaceBelow}px`,
    visibility: 'visible'
  }
}

const close = (restoreFocus = false) => {
  emit('update:open', false)
  if (restoreFocus) nextTick(() => trigger()?.focus({ preventScroll: true }))
}

const toggle = () => emit('update:open', !props.open)

const handlePanelTab = (event: KeyboardEvent) => {
  if (props.haspopup !== 'menu') return
  const button = trigger()
  if (!button) return
  const scope = button.closest('[data-app-drawer], dialog[open]') ?? document
  const available = focusableElements(scope).filter(element => !panel.value?.contains(element))
  const index = available.indexOf(button)
  const next = available[index + (event.shiftKey ? -1 : 1)]
    ?? (event.shiftKey ? available.at(-1) : available[0])
  event.preventDefault()
  close()
  void nextTick(() => next?.focus({ preventScroll: true }))
}

const focusEdge = (edge: 'first' | 'last') => {
  const available = panel.value ? focusableElements(panel.value) : []
  const target = edge === 'last' ? available.at(-1) : available[0]
  target?.focus({ preventScroll: true })
}

const handleTriggerKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.open) {
    event.preventDefault()
    close(true)
    return
  }
  const menuKey = props.haspopup === 'menu' && ['ArrowUp', 'Enter', ' '].includes(event.key)
  if (event.key !== 'ArrowDown' && !menuKey) return
  event.preventDefault()
  const edge = event.key === 'ArrowUp' ? 'last' : 'first'
  if (props.open) focusEdge(edge)
  else {
    requestedFocus = edge
    emit('update:open', true)
  }
}

const handleDocumentPointerDown = (event: PointerEvent) => {
  if (!props.open) return
  const target = event.target as Node
  if (!anchor.value?.contains(target) && !panel.value?.contains(target)) close()
}

watch(() => props.open, async (isOpen) => {
  if (!isOpen) { requestedFocus = undefined; return }
  panelStyle.value = {
    width: props.width === 'content' ? 'max-content' : undefined,
    maxWidth: 'calc(100vw - var(--space) * 2)',
    visibility: 'hidden'
  }
  await nextTick()
  if (panel.value) resizeObserver?.observe(panel.value)
  position()
  // Positioning removes visibility:hidden on the next render. Focus afterward.
  await nextTick()
  if (props.open && requestedFocus) focusEdge(requestedFocus)
  requestedFocus = undefined
}, { immediate: true })

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  window.addEventListener('resize', position)
  window.visualViewport?.addEventListener('resize', position)
  window.visualViewport?.addEventListener('scroll', position)
  window.addEventListener('scroll', position, true)
  resizeObserver = new ResizeObserver(position)
  if (anchor.value) resizeObserver.observe(anchor.value)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  window.removeEventListener('resize', position)
  window.visualViewport?.removeEventListener('resize', position)
  window.visualViewport?.removeEventListener('scroll', position)
  window.removeEventListener('scroll', position, true)
  resizeObserver?.disconnect()
})

defineExpose({ close, position })
</script>

<template>
  <div ref="anchor" class="app-popover">
    <span ref="spaceMeasure" class="app-popover-space-measure" aria-hidden="true" />
    <slot
      name="trigger"
      :open="open"
      :trigger-props="{
        'data-popover-trigger': '',
        'aria-expanded': open,
        'aria-controls': open ? contentId : undefined,
        'aria-haspopup': haspopup,
        onClick: toggle,
        onKeydown: handleTriggerKeydown
      }"
    />
    <Teleport :to="teleportTo">
      <div
        v-if="open"
        :id="contentId"
        ref="panel"
        data-drawer-scroll
        :class="['app-popover-content', panelClass]"
        :style="panelStyle"
        @keydown.esc.stop.prevent="close(true)"
        @keydown.tab="handlePanelTab"
      >
        <slot :close="close" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.app-popover-space-measure {
  position: fixed;
  width: var(--space);
  height: 0;
  visibility: hidden;
  pointer-events: none;
}
</style>
