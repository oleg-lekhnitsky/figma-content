<script setup lang="ts">
defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{
  src: string
  srcset?: string
  mimeType?: string | null
  width?: number
  height?: number
  alt?: string
  loading?: 'eager' | 'lazy'
  fetchpriority?: 'high' | 'low' | 'auto'
}>(), { srcset: undefined, mimeType: null, width: undefined, height: undefined, alt: '', loading: 'lazy', fetchpriority: 'auto' })
defineEmits<{ load: [] }>()
</script>

<template>
  <video v-if="mimeType?.startsWith('video/')" v-bind="$attrs" :src="src" :width="width" :height="height" autoplay muted loop playsinline preload="metadata" :aria-label="alt || undefined" @loadeddata="$emit('load')" />
  <img v-else v-bind="$attrs" :src="src" :srcset="srcset" :width="width" :height="height" :alt="alt" :loading="loading" :fetchpriority="fetchpriority" decoding="async" @load="$emit('load')">
</template>
