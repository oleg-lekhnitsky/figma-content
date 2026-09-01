<script setup lang="ts">
import { MoreH } from 'reicon-vue'

export interface PersonRowOption {
  value: string
  label: string
}

export interface PersonRowAction {
  value: string
  label: string
}

withDefaults(defineProps<{
  name: string
  avatarUrl?: string | null
  fallback?: string
  meta?: string
  metaTitle?: string
  badge?: string
  feedback?: string
  role: string
  roleOptions?: readonly PersonRowOption[]
  actions?: readonly PersonRowAction[]
  roleOpen?: boolean
  actionsOpen?: boolean
  disabled?: boolean
}>(), {
  avatarUrl: null,
  fallback: '?',
  meta: '',
  metaTitle: '',
  badge: '',
  feedback: '',
  roleOptions: () => [],
  actions: () => [],
  roleOpen: false,
  actionsOpen: false,
  disabled: false
})

const emit = defineEmits<{
  'update:roleOpen': [open: boolean]
  'update:actionsOpen': [open: boolean]
  selectRole: [role: string]
  selectAction: [action: string]
}>()
</script>

<template>
  <article class="app-person-row">
    <span class="app-person-avatar" aria-hidden="true">
      <img v-if="avatarUrl" :src="avatarUrl" alt="">
      <span v-else>{{ fallback }}</span>
    </span>
    <div class="app-person-copy">
      <div class="app-person-heading">
        <strong>{{ name }}</strong>
        <span v-if="badge" class="app-person-badge">{{ badge }}</span>
      </div>
      <span v-if="meta" :title="metaTitle || undefined">{{ meta }}</span>
      <span v-if="feedback" class="app-person-feedback" role="status" aria-live="polite">{{ feedback }}</span>
    </div>
    <div class="app-person-controls">
      <AppDropdownMenu
        v-if="roleOptions.length"
        :open="roleOpen"
        class="app-person-role"
        width="anchor"
        content-class="panel-dropdown-menu"
        @update:open="emit('update:roleOpen', $event)"
      >
        <template #trigger="{ triggerProps }">
          <button v-bind="triggerProps" class="panel-field panel-dropdown-trigger" type="button" :disabled="disabled" :aria-label="`Role for ${name}`">
            <span>{{ role }}</span>
            <span class="filter-dropdown-chevron" aria-hidden="true" />
          </button>
        </template>
        <template #default>
          <button
            v-for="option in roleOptions"
            :key="option.value"
            role="menuitemradio"
            type="button"
            :aria-checked="role.toLocaleLowerCase() === option.value.toLocaleLowerCase()"
            :disabled="disabled"
            @click="emit('selectRole', option.value)"
          >
            {{ option.label }}
          </button>
        </template>
      </AppDropdownMenu>
      <span v-else class="panel-field app-person-static-role">{{ role }}</span>
      <AppDropdownMenu
        v-if="actions.length"
        :open="actionsOpen"
        align="end"
        content-class="panel-dropdown-menu"
        @update:open="emit('update:actionsOpen', $event)"
      >
        <template #trigger="{ triggerProps }">
          <button v-bind="triggerProps" class="panel-secondary-action panel-icon-action app-person-more" type="button" :disabled="disabled" :aria-label="`Actions for ${name}`">
            <MoreH :size="18" aria-hidden="true" />
          </button>
        </template>
        <template #default>
          <button v-for="action in actions" :key="action.value" role="menuitem" type="button" :disabled="disabled" @click.stop="emit('selectAction', action.value)">
            {{ action.label }}
          </button>
        </template>
      </AppDropdownMenu>
    </div>
  </article>
</template>

<style scoped>
.app-person-row {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--filter-action-gap);
  padding: var(--filter-action-gap);
  border-radius: calc(var(--radius) * 1.5);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
}

.app-person-avatar {
  position: relative;
  width: calc(var(--filter-action-height) - .5rem);
  height: calc(var(--filter-action-height) - .5rem);
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  color: var(--color-fg);
  background: var(--color-surface);
  font: inherit;
  line-height: 1;
}

.app-person-avatar img,
.app-person-avatar > span {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.app-person-avatar img { display: block; object-fit: cover; }
.app-person-avatar > span { display: grid; place-items: center; }

.app-person-copy {
  min-width: 0;
  display: grid;
  gap: calc(var(--filter-option-gap) * .5);
  padding: calc(var(--filter-option-padding) / 2);
}

.app-person-heading {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--filter-option-gap);
  line-height: 1.2;
}

.app-person-copy strong {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  font-size: var(--filter-action-font-size);
  font-weight: 500;
  line-height: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-person-copy > span {
  min-width: 0;
  overflow: hidden;
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-caption);
  font-weight: 400;
  letter-spacing: var(--letter-spacing-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-person-copy > .app-person-feedback { color: var(--filter-overlay-panel-color); }

.app-person-badge {
  flex: 0 0 auto;
  padding: .2rem .45rem;
  border-radius: 999px;
  color: var(--filter-overlay-primary-color);
  background: var(--filter-overlay-primary-background);
  font-size: .625rem;
  font-weight: 500;
  letter-spacing: var(--letter-spacing-caption);
  line-height: 1;
}

.app-person-controls {
  display: flex;
  align-items: center;
  gap: var(--filter-action-gap);
}

.app-person-role { width: 7.5rem; min-width: 0; }
.app-person-role .panel-field,
.app-person-static-role { min-height: calc(var(--filter-action-height) - .5rem); }

.app-person-static-role {
  width: 7.5rem;
  display: inline-flex;
  align-items: center;
  text-transform: capitalize;
}

.app-person-more.panel-icon-action {
  width: calc(var(--filter-action-height) - .5rem);
  min-width: calc(var(--filter-action-height) - .5rem);
  min-height: calc(var(--filter-action-height) - .5rem);
  flex-basis: calc(var(--filter-action-height) - .5rem);
}

@media (max-width: 520px) {
  .app-person-row { grid-template-columns: auto minmax(0, 1fr); }
  .app-person-controls { grid-column: 1 / -1; justify-content: stretch; }
  .app-person-role,
  .app-person-static-role { width: auto; flex: 1 1 auto; }
}
</style>
