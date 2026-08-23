<script setup lang="ts">
import type { CSSProperties } from 'vue'

const props = withDefaults(defineProps<{
  open?: boolean
  width?: number | 'content' | 'anchor'
  offset?: number
  gutter?: number
  align?: 'start' | 'end'
  haspopup?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'
  teleportTo?: string | HTMLElement
}>(), {
  open: false,
  width: 'content',
  offset: undefined,
  gutter: undefined,
  align: 'start',
  haspopup: true,
  teleportTo: 'body'
})

const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const anchor = ref<HTMLElement>()
const panel = ref<HTMLElement>()
const spaceMeasure = ref<HTMLElement>()
const contentId = useId()
const panelStyle = ref<CSSProperties>({ visibility: 'hidden' })
let resizeObserver: ResizeObserver | undefined

const trigger = () => anchor.value?.querySelector<HTMLElement>('[data-popover-trigger]')

const position = () => {
  const triggerElement = trigger()
  if (!props.open || !triggerElement) return

  const space = spaceMeasure.value?.getBoundingClientRect().width || 12
  const gutter = props.gutter ?? space
  const offset = props.offset ?? space / 3
  const triggerRect = triggerElement.getBoundingClientRect()
  const availableWidth = window.innerWidth - gutter * 2
  const panelWidth = typeof props.width === 'number'
    ? Math.min(props.width, availableWidth)
    : props.width === 'anchor'
      ? Math.min(triggerRect.width, availableWidth)
      : Math.min(Math.max(panel.value?.scrollWidth ?? 0, triggerRect.width), availableWidth)
  const measuredHeight = panel.value?.offsetHeight ?? 0
  const spaceBelow = window.innerHeight - triggerRect.bottom - offset - gutter
  const spaceAbove = triggerRect.top - offset - gutter
  const placeAbove = measuredHeight > spaceBelow && spaceAbove > spaceBelow
  const desiredLeft = props.align === 'end' ? triggerRect.right - panelWidth : triggerRect.left
  const left = Math.max(gutter, Math.min(desiredLeft, window.innerWidth - panelWidth - gutter))
  const top = placeAbove
    ? Math.max(gutter, triggerRect.top - offset - measuredHeight)
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
  if (restoreFocus) nextTick(() => trigger()?.focus())
}

const toggle = () => emit('update:open', !props.open)

const focusFirst = () => {
  panel.value?.querySelector<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')?.focus()
}

const handleTriggerKeydown = async (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.open) {
    event.preventDefault()
    close(true)
    return
  }
  if (event.key !== 'ArrowDown') return
  event.preventDefault()
  if (!props.open) emit('update:open', true)
  await nextTick()
  focusFirst()
}

const handleDocumentPointerDown = (event: PointerEvent) => {
  const target = event.target as Node
  if (!anchor.value?.contains(target) && !panel.value?.contains(target)) close()
}

watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  panelStyle.value = {
    width: props.width === 'content' ? 'max-content' : undefined,
    maxWidth: 'calc(100vw - var(--space) * 2)',
    visibility: 'hidden'
  }
  await nextTick()
  if (panel.value) resizeObserver?.observe(panel.value)
  position()
})

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  window.addEventListener('resize', position)
  window.addEventListener('scroll', position, true)
  resizeObserver = new ResizeObserver(position)
  if (anchor.value) resizeObserver.observe(anchor.value)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  window.removeEventListener('resize', position)
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
        class="app-popover-content"
        :style="panelStyle"
        @keydown.esc.stop.prevent="close(true)"
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
