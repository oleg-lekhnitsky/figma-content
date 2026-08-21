<script setup lang="ts">
defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{
  src: string
  srcset?: string
  sizes?: string
  singleResolutionMedia?: string
  mimeType?: string | null
  width?: number
  height?: number
  alt?: string
  loading?: 'eager' | 'lazy'
  fetchpriority?: 'high' | 'low' | 'auto'
}>(), { srcset: undefined, sizes: undefined, singleResolutionMedia: undefined, mimeType: null, width: undefined, height: undefined, alt: '', loading: 'lazy', fetchpriority: 'auto' })
defineEmits<{ load: [] }>()
</script>

<template>
  <video v-if="mimeType?.startsWith('video/')" v-bind="$attrs" :src="src" :width="width" :height="height" autoplay muted loop playsinline preload="metadata" :aria-label="alt || undefined" @loadeddata="$emit('load')" />
  <template v-else>
    <picture v-if="singleResolutionMedia" class="asset-media-picture">
      <source :media="singleResolutionMedia" :srcset="src">
      <img v-bind="$attrs" :src="src" :srcset="srcset" :sizes="sizes" :width="width" :height="height" :alt="alt" :loading="loading" :fetchpriority="fetchpriority" decoding="async" @load="$emit('load')">
    </picture>
    <img v-else v-bind="$attrs" :src="src" :srcset="srcset" :sizes="sizes" :width="width" :height="height" :alt="alt" :loading="loading" :fetchpriority="fetchpriority" decoding="async" @load="$emit('load')">
  </template>
</template>

<style scoped>
.asset-media-picture {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
