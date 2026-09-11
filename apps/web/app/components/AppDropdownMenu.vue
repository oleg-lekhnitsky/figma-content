<script setup lang="ts">
withDefaults(defineProps<{
  open?: boolean
  width?: number | 'content'
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
      <slot name="trigger" :open="open" :trigger-props="triggerProps" />
    </template>
    <template #default="{ close }">
      <div
        ref="content"
        role="menu"
        :class="['app-dropdown-menu-content', contentClass]"
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
.app-dropdown-menu-content {
  --menu-inset: calc(var(--space) / 4);
  --menu-row-gap: 2px;
  --menu-row-height: var(--filter-action-height);
  --menu-padding: calc(var(--space) / 2.5);
  --menu-radius: max(0px, calc(var(--popover-radius) - var(--menu-padding)));
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  display: grid;
  gap: var(--menu-row-gap);
  padding: var(--menu-padding);
  border-radius: var(--popover-radius);
  color: var(--filter-overlay-panel-color);
  background: var(--filter-overlay-nested-background);
}

.app-dropdown-menu-content :deep([role^='menuitem']) {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: var(--menu-row-height);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin: 0;
  border-radius: var(--menu-radius);
  padding: var(--menu-inset) var(--filter-option-padding);
  color: inherit;
  background: transparent;
  font-size: var(--font-size-control);
  line-height: 1.25;
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: start;
  opacity: 1;
}

.app-dropdown-menu-content :deep([role^='menuitem']:is(:hover, :focus-visible)) {
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
}

.app-dropdown-menu-content :deep([role^='menuitem']:focus-visible) {
  outline-offset: calc(var(--filter-focus-width) * -1);
}

.app-dropdown-menu-content :deep([role^='menuitem'][aria-checked='true']) {
  color: var(--filter-overlay-primary-color);
  background: var(--filter-overlay-primary-background);
}

.app-dropdown-menu-content :deep([role^='menuitem']:is(:disabled, [aria-disabled='true'])) {
  opacity: .45;
}

@media (max-width: 520px) {
  .app-dropdown-menu-content {
    --menu-padding: calc(var(--space) * 2 / 3);
    --menu-row-height: var(--control-height);
  }

  .app-dropdown-menu-content :deep([role^='menuitem']) {
    padding-inline: var(--space);
    font-size: var(--font-size-body);
  }
}
</style>
