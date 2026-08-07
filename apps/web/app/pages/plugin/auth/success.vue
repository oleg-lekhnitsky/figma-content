<script setup lang="ts">
const route = useRoute()
const code = ref(typeof route.query.code === 'string' ? route.query.code : '')
const hasCode = computed(() => code.value.length > 0)
const copied = ref(false)
const copyCode = async () => {
  await navigator.clipboard.writeText(code.value)
  copied.value = true
}
onMounted(() => {
  if (hasCode.value) window.history.replaceState({}, '', route.path)
})
</script>

<template>
  <main class="page-shell"><section class="message-panel"><p class="eyebrow">Figma plugin</p>
    <h1 class="display-title">{{ hasCode ? 'Authentication complete.' : 'Authentication failed.' }}</h1>
    <template v-if="hasCode">
      <p class="muted">Copy this one-time code, return to the Content Library plugin, and paste it there within one minute.</p>
      <code>{{ code }}</code>
      <button type="button" @click="copyCode">{{ copied ? 'Code copied' : 'Copy one-time code' }}</button>
      <p class="copy-status" role="status" aria-live="polite">{{ copied ? 'The code is ready to paste in Figma.' : '' }}</p>
    </template>
    <p v-else class="muted">No plugin authorization code was provided. Return to Figma and try again.</p>
  </section></main>
</template>

<style scoped>code{display:block;overflow-wrap:anywhere;margin:calc(var(--space)*2) 0;padding:var(--space);border-radius:var(--radius);background:var(--color-surface);font-family:ui-monospace,monospace;font-weight:500}.copy-status{min-height:1.15em}</style>
