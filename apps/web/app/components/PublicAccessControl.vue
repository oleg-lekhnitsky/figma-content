<script setup lang="ts">
import CopyLinkIcon from '~/components/CopyLinkIcon.vue'
import OpenLinkIcon from '~/components/OpenLinkIcon.vue'

withDefaults(defineProps<{
  publicationEnabled: boolean
  disabled?: boolean
  destinationUrl?: string
  destinationLabel?: string
}>(), {
  disabled: false,
  destinationUrl: '',
  destinationLabel: 'Open public page in a new tab'
})
defineEmits<{ setPublication: [value: boolean]; copyLink: [] }>()
const headingId = useId()
</script>

<template>
  <section class="filter-option-group board-public-access" role="group" :aria-labelledby="headingId">
    <div class="board-public-access-heading">
      <h2 :id="headingId" class="filter-overlay-title">Public access</h2>
      <Transition name="public-access-actions">
        <span v-if="destinationUrl" class="public-access-actions">
          <a class="public-access-icon" :href="destinationUrl" target="_blank" rel="noopener" :aria-label="destinationLabel" :title="destinationLabel"><OpenLinkIcon aria-hidden="true" /></a>
          <button v-if="publicationEnabled" class="public-access-icon" type="button" aria-label="Copy public link" title="Copy public link" @click="$emit('copyLink')"><CopyLinkIcon aria-hidden="true" /></button>
        </span>
      </Transition>
    </div>
    <div class="filter-option-list filter-option-list--segmented">
      <button type="button" :aria-pressed="!publicationEnabled" :disabled="disabled" @click="$emit('setPublication', false)">Unpublished</button>
      <button type="button" :aria-pressed="publicationEnabled" :disabled="disabled" @click="$emit('setPublication', true)">Published</button>
    </div>
  </section>
</template>

<style scoped>
.board-public-access-heading {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--filter-option-gap);
}

.board-public-access-heading > .filter-overlay-title {
  margin: 0;
}

.public-access-actions {
  display: inline-flex;
  flex: 0 0 auto;
  gap: var(--filter-option-gap);
  margin-inline-end: calc(var(--filter-option-padding) / 2);
  overflow: hidden;
}

.public-access-icon {
  box-sizing: border-box;
  inline-size: var(--filter-option-height);
  block-size: var(--filter-option-height);
  min-inline-size: var(--filter-option-height);
  min-block-size: var(--filter-option-height);
  max-inline-size: var(--filter-option-height);
  max-block-size: var(--filter-option-height);
  flex: 0 0 var(--filter-option-height);
  display: inline-grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--filter-overlay-panel-color);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
  line-height: 0;
  text-decoration: none;
  cursor: pointer;
}

.public-access-icon:hover {
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 11%, transparent);
}

.public-access-icon:active {
  transform: scale(.96);
}

.public-access-icon:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

.public-access-icon svg {
  fill: none;
  stroke: currentColor;
}

.public-access-icon :deep(:is(.copy-link-icon, .open-link-icon)) {
  width: 100%;
  height: 100%;
}

@media (max-width: 520px) {
  .board-public-access {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }

  .board-public-access-heading {
    display: contents;
  }

  .board-public-access-heading > .filter-overlay-title {
    grid-column: 1 / -1;
  }

  .board-public-access > .filter-option-list--segmented {
    grid-column: 1;
    grid-row: 2;
  }

  .public-access-actions {
    grid-column: 2;
    grid-row: 2;
    margin-inline-end: 0;
  }
}

.public-access-actions-enter-active,
.public-access-actions-leave-active {
  max-width: calc(var(--filter-option-height) * 2 + var(--filter-option-gap));
  transition:
    max-width 280ms cubic-bezier(.2, .8, .2, 1),
    opacity 180ms ease,
    translate 280ms cubic-bezier(.2, .8, .2, 1);
}

.public-access-actions-enter-from,
.public-access-actions-leave-to {
  max-width: 0;
  opacity: 0;
  translate: -.375rem 0;
}

@media (prefers-reduced-motion: reduce) {
  .public-access-actions-enter-active,
  .public-access-actions-leave-active { transition: none; }
}

</style>
