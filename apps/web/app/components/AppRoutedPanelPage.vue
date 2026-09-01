<script setup lang="ts">
import { Xmark } from 'reicon-vue'

const props = defineProps<{
  label: string
  closeLabel: string
  panelClass?: string
  closeDisabled?: boolean
}>()

const visible = ref(false)
let openFrame = 0

const close = () => {
  if (!visible.value) return
  visible.value = false
}

const requestClose = () => {
  if (!props.closeDisabled) close()
}

onMounted(() => {
  openFrame = requestAnimationFrame(() => { visible.value = true })
})

onBeforeUnmount(() => cancelAnimationFrame(openFrame))

defineExpose({ close })
</script>

<template>
  <SelectionPanel :visible="visible" :label="label" wide overlay :close-disabled="closeDisabled" @close="requestClose" @after-leave="navigateTo('/library')">
    <div class="asset-filter-controls asset-filter-controls--filters asset-filter-controls--expanded" :class="panelClass">
      <button class="filter-sheet-handle" type="button" :disabled="closeDisabled" :aria-label="closeLabel" @click="requestClose"><span aria-hidden="true" /></button>
      <slot />
    </div>
    <button class="filter-panel-toggle is-expanded" type="button" :disabled="closeDisabled" :aria-label="closeLabel" aria-expanded="true" @click="requestClose">
      <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
    </button>
  </SelectionPanel>
</template>
