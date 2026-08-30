<script setup lang="ts">
export interface RolePickerOption {
  value: string
  label: string
  description: string
  separated?: boolean
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: readonly RolePickerOption[]
  open?: boolean
  ariaLabel?: string
}>(), {
  open: false,
  ariaLabel: 'Role'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:open': [value: boolean]
}>()

const selectedOption = computed(() => props.options.find(option => option.value === props.modelValue) ?? props.options[0])
</script>

<template>
  <AppDropdownMenu
    :open="open"
    width="anchor"
    content-class="panel-dropdown-menu app-role-picker-menu"
    @update:open="emit('update:open', $event)"
  >
    <template #trigger="{ triggerProps }">
      <button v-bind="triggerProps" class="panel-field panel-dropdown-trigger app-role-picker-trigger" type="button" :aria-label="ariaLabel">
        <span>{{ selectedOption?.label }}</span>
        <span class="filter-dropdown-chevron" aria-hidden="true" />
      </button>
    </template>
    <template #default>
      <button
        v-for="option in options"
        :key="option.value"
        class="app-role-picker-option"
        :class="{ 'is-separated': option.separated }"
        role="menuitemradio"
        type="button"
        :aria-checked="modelValue === option.value"
        @click="emit('update:modelValue', option.value)"
      >
        <span class="app-role-picker-copy">
          <strong>{{ option.label }}</strong>
          <small>{{ option.description }}</small>
        </span>
      </button>
    </template>
  </AppDropdownMenu>
</template>

<style scoped>
.app-role-picker-trigger { width: 100%; }

:global(.app-role-picker-menu.panel-dropdown-menu) {
  min-width: min(22rem, calc(100vw - var(--space) * 2));
}

.app-role-picker-option {
  min-height: auto;
  padding: var(--filter-option-padding);
}

.app-role-picker-option.is-separated {
  margin-top: calc(var(--filter-option-gap) / 2);
  border-top: var(--filter-hairline) solid var(--filter-overlay-border-color);
}

.app-role-picker-copy {
  min-width: 0;
  display: grid;
  gap: calc(var(--filter-option-gap) / 2);
}

.app-role-picker-copy strong {
  font-size: var(--filter-action-font-size);
  font-weight: 500;
  line-height: 1.1;
}

.app-role-picker-copy small {
  color: inherit;
  opacity: .62;
  font-size: var(--font-size-caption);
  font-weight: 400;
  letter-spacing: var(--letter-spacing-caption);
  line-height: 1.2;
}
</style>
