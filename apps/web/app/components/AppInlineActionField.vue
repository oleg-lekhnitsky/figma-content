<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: string
  label?: string
  placeholder?: string
  actionLabel: string
  busyLabel?: string
  showAction?: boolean
  busy?: boolean
  disabled?: boolean
  autocomplete?: string
  inputType?: string
  minLength?: number
  maxLength?: number
}>(), {
  label: 'Email',
  placeholder: 'Email',
  busyLabel: 'Working…',
  showAction: false,
  busy: false,
  disabled: false,
  autocomplete: 'email',
  inputType: 'email',
  minLength: 0,
  maxLength: 0
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const input = ref<HTMLInputElement | null>(null)

const measureAction = (element: Element) => {
  const action = element as HTMLElement
  const width = Math.max(action.scrollWidth, action.getBoundingClientRect().width)
  action.parentElement?.style.setProperty('--app-inline-action-width', `${Math.ceil(width)}px`)
}

const clearActionMeasure = (element: Element) => {
  element.parentElement?.style.removeProperty('--app-inline-action-width')
}

const focus = () => input.value?.focus()
defineExpose({ focus })
</script>

<template>
  <div class="app-inline-action-field">
    <label>
      <span class="sr-only">{{ label }}</span>
      <input
        ref="input"
        class="panel-field"
        required
        :type="inputType"
        :autocomplete="autocomplete"
        :minlength="minLength || undefined"
        :maxlength="maxLength || undefined"
        :placeholder="placeholder"
        :value="modelValue"
        :disabled="disabled"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      >
    </label>
    <Transition
      name="app-inline-action"
      @enter="measureAction"
      @before-leave="measureAction"
      @after-leave="clearActionMeasure"
    >
      <button
        v-if="showAction"
        class="panel-primary-action app-inline-action-button"
        type="submit"
        :disabled="disabled || busy"
      >
        {{ busy ? busyLabel : actionLabel }}
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.app-inline-action-field {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 0;
  align-items: center;
  gap: 0;
  transition:
    grid-template-columns var(--filter-action-transition-duration) var(--filter-overlay-enter-easing),
    column-gap var(--filter-action-transition-duration) var(--filter-overlay-enter-easing);
}

.app-inline-action-field:has(.app-inline-action-button) {
  grid-template-columns: minmax(0, 1fr) var(--app-inline-action-width, 0px);
  column-gap: var(--filter-action-gap);
}

.app-inline-action-field:has(.app-inline-action-enter-from),
.app-inline-action-field:has(.app-inline-action-leave-to) {
  grid-template-columns: minmax(0, 1fr) 0;
  column-gap: 0;
}

.app-inline-action-field:has(.app-inline-action-leave-active) {
  transition-delay: 200ms;
}

.app-inline-action-field > label { min-width: 0; }
.app-inline-action-field .panel-field { width: 100%; min-width: 0; }

.app-inline-action-button.panel-primary-action {
  justify-self: end;
  width: max-content;
  min-width: max-content;
  white-space: nowrap;
}

.app-inline-action-button.panel-primary-action:is(.app-inline-action-enter-active, .app-inline-action-leave-active) {
  transition:
    opacity var(--filter-action-transition-duration) var(--filter-overlay-enter-easing),
    translate var(--filter-action-transition-duration) var(--filter-overlay-enter-easing);
}

.app-inline-action-button.panel-primary-action.app-inline-action-enter-active {
  transition-delay: 200ms;
}

.app-inline-action-button.panel-primary-action.app-inline-action-enter-from {
  max-width: 0;
  opacity: 0;
  translate: -.375rem 0;
}

.app-inline-action-button.panel-primary-action.app-inline-action-leave-to {
  opacity: 0;
  translate: -.375rem 0;
}

@media (prefers-reduced-motion: reduce) {
  .app-inline-action-field,
  .app-inline-action-enter-active,
  .app-inline-action-leave-active { transition: none; }
}
</style>
