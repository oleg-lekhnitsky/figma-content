<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const id = String(route.params.id)
const { data, error } = await useFetch<{ data: { collection: { purpose: string } } }>(`/api/shares/${encodeURIComponent(id)}`)
if (error.value || !data.value) throw createError({ statusCode: error.value?.statusCode ?? 404, statusMessage: 'Board unavailable' })

// Preserve bookmarked board URLs without retaining the retired review interface.
await navigateTo(data.value.data.collection.purpose === 'portfolio'
  ? { path: '/portfolio', query: { view: 'details', portfolio: id } }
  : { path: '/library', query: { board: id, ...(['settings', 'members'].includes(String(route.query.view)) ? { panel: 'settings' } : {}) } },
{ replace: true })
</script>

<template>
  <div />
</template>
