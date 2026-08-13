<script setup lang="ts" generic="T extends AssetMasonryItem">
import type { BoardLayout, BoardViewSettings } from '@content-library/shared'
import type { AssetMasonryItem } from '../types/asset-masonry'
import AssetGrid from './AssetGrid.vue'
import AssetMasonry from './AssetMasonry.vue'
import AssetPresentation from './AssetPresentation.vue'

defineSlots<{
  details(props: { asset: T }): unknown
  previewActions(props: { asset: T }): unknown
  actions(props: { asset: T }): unknown
}>()

withDefaults(defineProps<{
  assets: T[]
  layout: BoardLayout
  label?: string
  headingTag?: 'h2' | 'h3' | 'h4'
  selectable?: boolean
  selectedIds?: string[]
  rowFlow?: boolean
  viewSettings?: BoardViewSettings
}>(), {
  label: 'Board assets',
  headingTag: 'h3',
  selectable: false,
  selectedIds: () => [],
  rowFlow: false
})

defineEmits<{ toggleSelection: [asset: T] }>()
</script>

<template>
  <AssetPresentation
    v-if="layout === 'presentation'" :assets="assets" :label="`${label} presentation`" :selectable="selectable"
    :selected-ids="selectedIds" @toggle-selection="$emit('toggleSelection', $event)">
    <template #details="{ asset }"><slot name="details" :asset="asset" /></template>
    <template #previewActions="{ asset }"><slot name="previewActions" :asset="asset" /></template>
  </AssetPresentation>
  <AssetGrid
    v-else-if="layout === 'grid'" :assets="assets" :label="label" :heading-tag="headingTag" :selectable="selectable" :view-settings="viewSettings"
    :selected-ids="selectedIds" @toggle-selection="$emit('toggleSelection', $event)">
    <template #details="{ asset }"><slot name="details" :asset="asset" /></template>
    <template #previewActions="{ asset }"><slot name="previewActions" :asset="asset" /></template>
    <template #actions="{ asset }"><slot name="actions" :asset="asset" /></template>
  </AssetGrid>
  <AssetMasonry
    v-else :assets="assets" :layout="layout" :label="label" :heading-tag="headingTag" :selectable="selectable"
    :selected-ids="selectedIds" :row-flow="rowFlow" :view-settings="viewSettings" @toggle-selection="$emit('toggleSelection', $event)">
    <template #details="{ asset }"><slot name="details" :asset="asset" /></template>
    <template #previewActions="{ asset }"><slot name="previewActions" :asset="asset" /></template>
    <template #actions="{ asset }"><slot name="actions" :asset="asset" /></template>
  </AssetMasonry>
</template>
