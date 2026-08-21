<script setup lang="ts">
const props = withDefaults(defineProps<{
  open?: boolean
  width?: number | 'content' | 'anchor'
  offset?: number
  gutter?: number
  align?: 'start' | 'end'
  contentClass?: string
}>(), {
  open: false,
  width: 'content',
  offset: undefined,
  gutter: undefined,
  align: 'start',
  contentClass: ''
})

const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const content = ref<HTMLElement>()
let typeahead = ''
let typeaheadTimer: ReturnType<typeof setTimeout> | undefined

const setOpen = (value: boolean) => emit('update:open', value)

const items = () => Array.from(content.value?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? [])

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
  if (!item || item.getAttribute('aria-disabled') === 'true' || item.dataset.menuClose === 'false') return
  close(false)
}

const handlePointerMove = (event: PointerEvent) => {
  const item = (event.target as HTMLElement).closest<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])')
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
