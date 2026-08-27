<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  error?: string
}>(), {
  description: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  busy: false,
  error: '',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
  close: []
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)
const titleId = useId()
const descriptionId = useId()
let returnFocus: HTMLElement | null = null

const requestClose = () => {
  if (props.busy) return
  emit('update:open', false)
  emit('close')
}

const syncDialog = async (open: boolean) => {
  await nextTick()
  const element = dialog.value
  if (!element) return
  if (open && !element.open) {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element.showModal()
    cancelButton.value?.focus({ preventScroll: true })
  } else if (!open && element.open) {
    element.close()
  }
}

watch(() => props.open, syncDialog, { immediate: true })
onMounted(() => { void syncDialog(props.open) })
onBeforeUnmount(() => {
  if (dialog.value?.open) dialog.value.close()
})

const handleNativeClose = () => {
  if (props.open) emit('update:open', false)
  returnFocus?.focus({ preventScroll: true })
  returnFocus = null
}
</script>

<template>
  <dialog
    ref="dialog"
    class="app-dialog"
    :aria-labelledby="titleId"
    :aria-describedby="description ? descriptionId : undefined"
    @cancel.prevent="requestClose"
    @click.self="requestClose"
    @close="handleNativeClose"
  >
    <section class="app-dialog-panel">
      <header>
        <h2 :id="titleId">{{ title }}</h2>
        <p v-if="description" :id="descriptionId">{{ description }}</p>
      </header>

      <slot />
      <p v-if="error" class="app-dialog-error" role="alert">{{ error }}</p>

      <footer>
        <button ref="cancelButton" class="app-dialog-cancel filter-action-button" type="button" :disabled="busy" @click="requestClose">{{ cancelLabel }}</button>
        <button class="app-dialog-confirm filter-action-button" type="button" :disabled="busy" @click="emit('confirm')">{{ confirmLabel }}</button>
      </footer>
    </section>
  </dialog>
</template>

<style scoped>
.app-dialog {
  width: min(32rem, calc(100% - var(--space) * 2));
  max-width: none;
  margin: auto;
  padding: 0;
  overflow: visible;
  border: 0;
  border-radius: var(--filter-overlay-radius);
  color: var(--filter-overlay-panel-color);
  background: transparent;
  box-shadow: 0 24px 80px rgb(0 0 0 / .2);
}

.app-dialog::backdrop {
  background: var(--filter-overlay-backdrop-background);
  backdrop-filter: blur(var(--filter-overlay-blur));
  -webkit-backdrop-filter: blur(var(--filter-overlay-blur));
}

.app-dialog-panel {
  display: grid;
  gap: var(--filter-overlay-group-gap);
  padding: var(--filter-overlay-padding);
  border-radius: inherit;
  background: var(--filter-overlay-panel-background);
  backdrop-filter: blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation));
  -webkit-backdrop-filter: blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation));
}

.app-dialog header {
  display: grid;
  gap: var(--filter-action-gap);
}

.app-dialog h2,
.app-dialog p {
  margin: 0;
}

.app-dialog h2 {
  font-size: var(--filter-title-size);
  font-weight: 500;
  letter-spacing: -.04em;
  line-height: 1;
}

.app-dialog header p,
.app-dialog-error {
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-label);
  line-height: 1.25;
}

.app-dialog-error { color: color-mix(in srgb, var(--color-danger) 42%, #fff); }

.app-dialog footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--filter-action-gap);
}

.app-dialog button {
  width: 100%;
  min-height: var(--filter-action-height);
  margin: 0;
  padding: 0 var(--filter-action-padding);
  border: 0;
  border-radius: var(--filter-pill-radius);
  font-size: var(--filter-action-font-size);
  font-weight: 600;
}

.app-dialog-cancel {
  color: var(--filter-overlay-panel-color);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
}

.app-dialog-confirm {
  color: var(--filter-overlay-primary-color);
  background: var(--filter-overlay-primary-background);
}

@media (max-width: 520px) {
  .app-dialog {
    width: 100%;
    max-height: min(90%, 32rem);
    margin: auto 0 0;
    border-radius: calc(var(--radius-mobile) * 2) calc(var(--radius-mobile) * 2) 0 0;
  }

  .app-dialog-panel {
    padding: var(--filter-sheet-content-padding-mobile);
    background: var(--filter-overlay-panel-background-mobile);
  }

  .app-dialog footer { grid-template-columns: 1fr; }
  .app-dialog-confirm { grid-row: 1; }
  .app-dialog-cancel { grid-row: 2; }
  .app-dialog button { min-height: var(--range-control-height-mobile); font-size: var(--font-size-body); }
}

@media (forced-colors: active) {
  .app-dialog, .app-dialog button { border: 1px solid CanvasText; }
}
</style>
