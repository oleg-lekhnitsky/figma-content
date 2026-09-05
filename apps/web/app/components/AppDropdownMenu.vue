<script setup lang="ts">
const props = withDefaults(defineProps<{
  open?: boolean
  width?: number | 'content' | 'anchor'
  offset?: number
  gutter?: number
  align?: 'start' | 'end'
  contentClass?: string
  teleportTo?: string | HTMLElement
}>(), {
  open: false,
  width: 'content',
  offset: undefined,
  gutter: undefined,
  align: 'start',
  contentClass: '',
  teleportTo: 'body'
})

const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const content = ref<HTMLElement>()
let typeahead = ''
let typeaheadTimer: ReturnType<typeof setTimeout> | undefined

const setOpen = (value: boolean) => emit('update:open', value)

const items = () => Array.from(content.value?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"]):not(:disabled)') ?? [])

const focusItem = (index: number) => {
  const availableItems = items()
  if (!availableItems.length) return
  availableItems[(index + availableItems.length) % availableItems.length]?.focus()
}

const handleMenuKeydown = (event: KeyboardEvent) => {
  const availableItems = items()
  const activeIndex = availableItems.indexOf(document.activeElement as HTMLElement)

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    focusItem(activeIndex + (event.key === 'ArrowDown' ? 1 : -1))
    return
  }
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    focusItem(event.key === 'Home' ? 0 : availableItems.length - 1)
    return
  }
  if (event.key === 'Tab') {
    setOpen(false)
    return
  }
  if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return

  typeahead += event.key.toLocaleLowerCase()
  clearTimeout(typeaheadTimer)
  typeaheadTimer = setTimeout(() => { typeahead = '' }, 500)
  const start = Math.max(activeIndex + 1, 0)
  const orderedItems = [...availableItems.slice(start), ...availableItems.slice(0, start)]
  orderedItems.find(item => item.textContent?.trim().toLocaleLowerCase().startsWith(typeahead))?.focus()
}

const handleMenuClick = (event: MouseEvent, close: (restoreFocus?: boolean) => void) => {
  const item = (event.target as HTMLElement).closest<HTMLElement>('[role^="menuitem"]')
  if (!item || item.matches(':disabled') || item.getAttribute('aria-disabled') === 'true' || item.dataset.menuClose === 'false') return
  close(false)
}

const handlePointerMove = (event: PointerEvent) => {
  const item = (event.target as HTMLElement).closest<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"]):not(:disabled)')
  if (item && document.activeElement !== item) item.focus({ preventScroll: true })
}

const menuTriggerProps = (base: Record<string, unknown>) => ({
  ...base,
  'aria-haspopup': 'menu' as const,
  onKeydown: async (event: KeyboardEvent) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!props.open) setOpen(true)
      await nextTick()
      focusItem(items().length - 1)
      return
    }
    const handler = base.onKeydown as ((event: KeyboardEvent) => void | Promise<void>) | undefined
    await handler?.(event)
  }
})

onBeforeUnmount(() => clearTimeout(typeaheadTimer))
</script>

<template>
  <AppPopover
    :open="open"
    :width="width"
    :offset="offset"
    :gutter="gutter"
    :align="align"
    :teleport-to="teleportTo"
    panel-class="app-dropdown-menu-popover"
    haspopup="menu"
    @update:open="setOpen"
  >
    <template #trigger="{ triggerProps }">
      <slot name="trigger" :open="open" :trigger-props="menuTriggerProps(triggerProps)" />
    </template>
    <template #default="{ close }">
      <div
        ref="content"
        role="menu"
        :class="['app-dropdown-menu-content', 'material-tinted', contentClass]"
        @keydown="handleMenuKeydown"
        @pointermove="handlePointerMove"
        @click="handleMenuClick($event, close)"
      >
        <slot :close="close" />
      </div>
    </template>
  </AppPopover>
</template>

<style scoped>
@media (max-width: 520px) {
  .app-dropdown-menu-content {
    --menu-inset: calc(var(--space) * 2 / 3);
    --menu-row-gap: calc(var(--space) / 6);
    --menu-row-height: var(--control-height);
    --menu-padding: calc(var(--space) * 2 / 3);
    min-width: min(calc(var(--control-height) * 5), calc(100vw - var(--space) * 2));
    padding: var(--menu-padding)
  }

  .app-dropdown-menu-content :deep([role^='menuitem']) {
    border-radius: var(--menu-radius);
    padding-inline: var(--space);
    font-size: calc(var(--font-size-body) * 1.0625)
  }

  :global(.app-dropdown-menu-popover) {
    scrollbar-width: none
  }

  :global(.app-dropdown-menu-popover::-webkit-scrollbar) {
    display: none
  }
}
</style>
